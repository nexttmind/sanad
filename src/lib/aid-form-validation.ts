import { isLebanesePhone } from "@/lib/phone-normalize";
import {
  allAidFormFields,
  CORE_REFERENCE_BINDINGS,
  type AidFormField,
  type AidFormFieldBinding,
  type AidFormSchema,
  type AidFormVisibleWhen,
} from "@/lib/aid-form-schema";

export type AidFormValues = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function bool(v: unknown): boolean {
  return v === true;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function isPastOrToday(d: string): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}

function evalVisibleWhen(w: AidFormVisibleWhen, values: AidFormValues): boolean {
  const v = values[w.field_id];
  switch (w.op) {
    case "truthy":
      return !!v;
    case "eq":
      return v === w.value;
    case "includes":
      return Array.isArray(v) && v.includes(w.value);
    default:
      return false;
  }
}

export function isAidFormFieldVisible(
  field: AidFormField,
  values: AidFormValues,
  schema: AidFormSchema,
): boolean {
  if (field.parent_option) {
    const needsField = allAidFormFields(schema).find((f) => f.binding === "needs");
    const needs = needsField ? strArr(values[needsField.id]) : [];
    if (!needs.includes(field.parent_option)) return false;
  }
  if (field.visible_when && !evalVisibleWhen(field.visible_when, values)) return false;
  if (field.visible_when_any?.length && !field.visible_when_any.some((w) => evalVisibleWhen(w, values))) {
    return false;
  }
  return true;
}

export function initAidFormValues(schema: AidFormSchema): AidFormValues {
  const values: AidFormValues = {};
  for (const field of allAidFormFields(schema)) {
    if (field.type === "toggle" || field.type === "checkbox") values[field.id] = false;
    else if (field.type === "multiselect") values[field.id] = [];
    else values[field.id] = "";
  }
  return values;
}

const CORE_REF_MESSAGES: Record<string, string> = {
  ref_type: "يرجى اختيار نوع المرجع",
  ref_name: "يرجى إدخال اسم المرجع",
  ref_phone: "يرجى إدخال رقم هاتف المرجع",
  ref_region: "يرجى إدخال منطقة المرجع",
  ref_known: "يرجى تحديد منذ متى تعرفه",
};

/** Form-level error key for schema/config issues (no matching field `data-err`). */
export const AID_FORM_LEVEL_ERROR_KEY = "_form";

const MISSING_CORE_REF_MESSAGE =
  "تعذّر تحميل حقول المرجع في النموذج — يرجى تحديث الصفحة أو التواصل معنا.";

/** Always enforce core reference fields even if schema required flags were weakened. */
export function enforceCoreReferenceErrors(
  schema: AidFormSchema,
  values: AidFormValues,
  errors: Record<string, string | null>,
): void {
  let missingCoreBinding = false;
  for (const binding of CORE_REFERENCE_BINDINGS) {
    const field = findFieldByBinding(schema, binding);
    if (!field) {
      missingCoreBinding = true;
      continue;
    }
    const text = str(values[field.id]).trim();
    if (!text) {
      errors[field.id] = CORE_REF_MESSAGES[binding] ?? "هذا الحقل مطلوب";
      continue;
    }
    if (binding === "ref_phone" && !isLebanesePhone(text)) {
      errors[field.id] = "يرجى التحقق من صيغة الرقم";
    }
  }
  if (missingCoreBinding) {
    errors[AID_FORM_LEVEL_ERROR_KEY] = MISSING_CORE_REF_MESSAGE;
  }
}

export function validateAidFormValues(
  schema: AidFormSchema,
  values: AidFormValues,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};

  for (const field of allAidFormFields(schema)) {
    if (!isAidFormFieldVisible(field, values, schema)) continue;

    const raw = values[field.id];
    const forceRequired =
      field.required ||
      isCoreReferenceBindingSafe(field.binding) ||
      field.binding === "confirm";

    if (forceRequired) {
      if (field.type === "checkbox" || field.type === "toggle") {
        if (!bool(raw)) errors[field.id] = "هذا الحقل مطلوب";
        continue;
      }
      if (field.type === "multiselect") {
        if (strArr(raw).length === 0) errors[field.id] = "يرجى اختيار خيار واحد على الأقل";
        continue;
      }
      if (!str(raw).trim()) {
        errors[field.id] = CORE_REF_MESSAGES[field.binding ?? ""] ?? "هذا الحقل مطلوب";
        continue;
      }
    }

    const text = str(raw).trim();
    if (!text && field.type !== "multiselect") continue;

    if (field.type === "tel" && text && !isLebanesePhone(text)) {
      errors[field.id] =
        field.binding === "ref_phone"
          ? "يرجى التحقق من صيغة الرقم"
          : "يرجى التحقق — رقم لبناني صحيح يبدأ بـ 03 أو 70 أو 71 أو 76 أو 78 أو 79 أو 81";
    }

    if (field.type === "number" && text) {
      const n = Number(text);
      if (Number.isNaN(n)) errors[field.id] = "يرجى إدخال رقماً صحيحاً";
      else {
        if (field.min != null && n < field.min) errors[field.id] = `الحد الأدنى ${field.min}`;
        if (field.max != null && n > field.max) errors[field.id] = `الحد الأقصى ${field.max}`;
      }
    }

    if (field.type === "textarea" && field.min_length && text.length < field.min_length) {
      errors[field.id] = `يرجى إدخال ${field.min_length} أحرف على الأقل`;
    }

    if (field.type === "date" && text && !isPastOrToday(text)) {
      errors[field.id] = "يرجى التحقق — التاريخ لا يمكن أن يكون في المستقبل";
    }
  }

  const childrenField = allAidFormFields(schema).find((f) => f.binding === "children");
  const infantsField = allAidFormFields(schema).find((f) => f.binding === "infants");
  if (childrenField && infantsField) {
    const u12 = Number(str(values[childrenField.id]));
    const u2 = Number(str(values[infantsField.id]));
    if (values[childrenField.id] !== "" && values[infantsField.id] !== "" && u2 > u12) {
      errors[infantsField.id] = "يرجى التحقق — عدد الرضّع لا يمكن أن يتجاوز عدد الأطفال";
    }
  }

  enforceCoreReferenceErrors(schema, values, errors);

  return errors;
}

function isCoreReferenceBindingSafe(binding?: AidFormFieldBinding): boolean {
  return !!binding && (CORE_REFERENCE_BINDINGS as readonly string[]).includes(binding);
}

export function getAidFormWarnings(schema: AidFormSchema, values: AidFormValues): string[] {
  const warnings: string[] = [];
  const dispField = allAidFormFields(schema).find((f) => f.binding === "displacement_date");
  const displacedField = allAidFormFields(schema).find((f) => f.binding === "displaced");
  const needsField = allAidFormFields(schema).find((f) => f.binding === "needs");
  const infantsField = allAidFormFields(schema).find((f) => f.binding === "infants");

  if (displacedField && bool(values[displacedField.id]) && dispField) {
    const d = str(values[dispField.id]);
    if (d) {
      const t = new Date(d).getTime();
      if (!Number.isNaN(t)) {
        const months = (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
        if (months > 6) {
          warnings.push("مرّ أكثر من ٦ أشهر على تاريخ النزوح — يرجى التأكد من صحة التاريخ.");
        }
      }
    }
  }

  if (needsField) {
    const needs = strArr(values[needsField.id]);
    if (needs.length >= 9) {
      warnings.push("اخترت عدداً كبيراً من الاحتياجات — يرجى التأكد من أنها جميعاً ضرورية فعلاً.");
    }
  }

  if (infantsField && needsField) {
    const u2 = Number(str(values[infantsField.id]));
    const needs = strArr(values[needsField.id]);
    if (u2 > 0 && !needs.includes("حفاضات") && !needs.includes("حليب أطفال")) {
      warnings.push("لديك رضّع في العائلة — هل تحتاج إلى حفاضات أو حليب أطفال؟");
    }
  }

  return warnings;
}

export function findFieldByBinding(schema: AidFormSchema, binding: string): AidFormField | undefined {
  return allAidFormFields(schema).find((f) => f.binding === binding);
}

export function valueByBinding(schema: AidFormSchema, values: AidFormValues, binding: string): unknown {
  const field = findFieldByBinding(schema, binding);
  return field ? values[field.id] : undefined;
}

export function phoneFieldId(schema: AidFormSchema): string | undefined {
  return findFieldByBinding(schema, "phone")?.id;
}
