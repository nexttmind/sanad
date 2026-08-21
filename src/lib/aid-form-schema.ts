import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type AidFormFieldType =
  | "text"
  | "number"
  | "tel"
  | "textarea"
  | "select"
  | "multiselect"
  | "toggle"
  | "date"
  | "checkbox";

/** Maps to submit payload / reference insert when set; otherwise stored in form_responses. */
export type AidFormFieldBinding =
  | "first_name"
  | "father_name"
  | "family_name"
  | "phone"
  | "alt_phone"
  | "family_size"
  | "children"
  | "infants"
  | "elderly_count"
  | "has_elderly"
  | "has_disabled"
  | "disabled_desc"
  | "has_chronic"
  | "chronic_desc"
  | "pregnant_or_nursing"
  | "displaced"
  | "origin"
  | "origin_village"
  | "current_loc"
  | "shelter"
  | "shelter_name"
  | "displacement_date"
  | "needs"
  | "diaper_size"
  | "infant_age"
  | "milk_brand"
  | "milk_stage"
  | "milk_age"
  | "clothes_desc"
  | "other_desc"
  | "notes"
  | "ref_type"
  | "ref_name"
  | "ref_phone"
  | "ref_region"
  | "ref_village"
  | "ref_known"
  | "ref_notes"
  | "confirm";

export type AidFormVisibleWhen = {
  field_id: string;
  op: "eq" | "truthy" | "includes";
  value?: string | boolean;
};

export type AidFormField = {
  id: string;
  type: AidFormFieldType;
  label: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  binding?: AidFormFieldBinding;
  /** Sub-field shown when a multiselect option is selected (e.g. حفاضات). */
  parent_option?: string;
  visible_when?: AidFormVisibleWhen;
  /** OR logic — e.g. shelter name for مدرسة or مأوى جماعي */
  visible_when_any?: AidFormVisibleWhen[];
  min_length?: number;
  min?: number;
  max?: number;
};

export type AidFormSection = {
  id: string;
  title: string;
  subtitle?: string;
  number_label: string;
  fields: AidFormField[];
};

export type AidFormSchema = {
  version: number;
  sections: AidFormSection[];
};

export const DEFAULT_AID_FORM_SCHEMA: AidFormSchema = {
  version: 1,
  sections: [
    {
      id: "personal",
      number_label: "٠١",
      title: "المعلومات الشخصية",
      subtitle: "الاسم الثلاثي كما يظهر في الهوية أو الجواز",
      fields: [
        { id: "first", type: "text", label: "الاسم الأول", required: true, placeholder: "مثال: محمد", binding: "first_name" },
        { id: "father", type: "text", label: "اسم الأب", required: true, placeholder: "مثال: علي", binding: "father_name" },
        { id: "family", type: "text", label: "اسم العائلة", required: true, placeholder: "مثال: الحسيني", binding: "family_name" },
        { id: "phone", type: "tel", label: "رقم الهاتف الأساسي", required: true, hint: "سنتواصل معك على هذا الرقم", placeholder: "+961 71 234 567", binding: "phone" },
        { id: "phone2", type: "tel", label: "رقم الهاتف الثانوي", placeholder: "+961 70 000 000", binding: "alt_phone" },
      ],
    },
    {
      id: "family",
      number_label: "٠٢",
      title: "معلومات العائلة",
      fields: [
        { id: "total", type: "number", label: "إجمالي عدد أفراد العائلة", required: true, min: 1, binding: "family_size" },
        { id: "u12", type: "number", label: "أطفال تحت ١٢ سنة", required: true, min: 0, binding: "children" },
        { id: "u2", type: "number", label: "رضّع تحت سنتين", required: true, min: 0, binding: "infants" },
        { id: "hasElderly", type: "toggle", label: "يوجد كبار في السن", binding: "has_elderly" },
        { id: "elderlyN", type: "number", label: "كم عدد كبار السن؟", required: true, min: 1, binding: "elderly_count", visible_when: { field_id: "hasElderly", op: "truthy" } },
        { id: "hasDisabled", type: "toggle", label: "يوجد شخص من ذوي الاحتياجات الخاصة", binding: "has_disabled" },
        { id: "disabledDesc", type: "textarea", label: "يرجى توضيح نوع الإعاقة", required: true, min_length: 10, binding: "disabled_desc", visible_when: { field_id: "hasDisabled", op: "truthy" } },
        { id: "hasChronic", type: "toggle", label: "يوجد مصاب بمرض مزمن", binding: "has_chronic" },
        { id: "chronicDesc", type: "textarea", label: "يرجى ذكر المرض", required: true, min_length: 10, binding: "chronic_desc", visible_when: { field_id: "hasChronic", op: "truthy" } },
        { id: "pregnantOrNursing", type: "toggle", label: "يوجد حامل أو مرضع في العائلة", binding: "pregnant_or_nursing" },
      ],
    },
    {
      id: "displacement",
      number_label: "٠٣",
      title: "معلومات النزوح",
      fields: [
        { id: "displaced", type: "toggle", label: "هل أنت نازح/ة؟", binding: "displaced" },
        { id: "origin", type: "select", label: "قضاء", required: true, binding: "origin", options: ["قضاء صور", "قضاء بنت جبيل", "قضاء مرجعيون", "قضاء النبطية", "قضاء حاصبيا", "منطقة أخرى"], visible_when: { field_id: "displaced", op: "truthy" } },
        { id: "originVillage", type: "text", label: "مكان الاقامة قبل النزوح", required: true, binding: "origin_village", visible_when: { field_id: "displaced", op: "truthy" } },
        { id: "currentLoc", type: "text", label: "موقعك الحالي", required: true, hint: "مثال: بيروت، صيدا، الجية", binding: "current_loc", visible_when: { field_id: "displaced", op: "truthy" } },
        { id: "shelter", type: "select", label: "نوع المأوى الحالي", required: true, binding: "shelter", options: ["مدرسة", "مأوى جماعي", "عند أهل أو أصدقاء", "منزل مستأجر", "أخرى"], visible_when: { field_id: "displaced", op: "truthy" } },
        {
          id: "shelterName",
          type: "text",
          label: "اسم المدرسة أو المأوى",
          required: true,
          binding: "shelter_name",
          visible_when_any: [
            { field_id: "shelter", op: "eq", value: "مدرسة" },
            { field_id: "shelter", op: "eq", value: "مأوى جماعي" },
          ],
        },
        { id: "dispDate", type: "date", label: "تاريخ النزوح", required: true, binding: "displacement_date", visible_when: { field_id: "displaced", op: "truthy" } },
      ],
    },
    {
      id: "needs",
      number_label: "٠٤",
      title: "الاحتياجات",
      subtitle: "اختر حاجة واحدة على الأقل",
      fields: [
        {
          id: "needs",
          type: "multiselect",
          label: "الاحتياجات",
          required: true,
          binding: "needs",
          options: ["طعام", "ملابس", "وسائد وفرش", "حفاضات", "حليب أطفال", "مروحة", "غاز", "مواد نظافة", "أغطية وبطانيات", "أخرى"],
        },
        { id: "diaperSize", type: "select", label: "قياس الحفاض", required: true, parent_option: "حفاضات", binding: "diaper_size", options: ["NB", "١", "٢", "٣", "٤", "٥", "٦"] },
        { id: "infantAge", type: "number", label: "عمر الرضيع (بالأشهر)", required: true, parent_option: "حفاضات", binding: "infant_age", min: 0, max: 36 },
        { id: "milkBrand", type: "select", label: "ماركة الحليب", required: true, parent_option: "حليب أطفال", binding: "milk_brand", options: ["Aptamil", "NAN", "Similac", "Enfamil", "أي ماركة متوفرة"] },
        { id: "milkStage", type: "select", label: "مرحلة الحليب", required: true, parent_option: "حليب أطفال", binding: "milk_stage", options: ["Stage 1 (٠–٦ أشهر)", "Stage 2 (٦–١٢ شهر)", "Stage 3 (١٢–٢٤ شهر)"] },
        { id: "milkAge", type: "number", label: "عمر الرضيع (بالأشهر)", required: true, parent_option: "حليب أطفال", binding: "milk_age", min: 0, max: 36 },
        { id: "clothesDesc", type: "textarea", label: "تفاصيل الملابس المطلوبة", required: true, min_length: 5, parent_option: "ملابس", binding: "clothes_desc" },
        { id: "otherDesc", type: "textarea", label: "وصف الحاجة", required: true, min_length: 5, parent_option: "أخرى", binding: "other_desc" },
        { id: "notes", type: "textarea", label: "ملاحظات عامة", hint: "أي معلومات إضافية تريد إيصالها لفريقنا", binding: "notes" },
      ],
    },
    {
      id: "reference",
      number_label: "٠٥",
      title: "المرجع",
      subtitle: "يرجى ذكر شخص موثوق من منطقتك يمكننا التواصل معه للتحقق من هويتك وأوضاعك",
      fields: [
        { id: "refType", type: "select", label: "نوع المرجع", required: true, binding: "ref_type", options: ["مختار", "شيخ البلد", "رجل دين", "مسؤول بلدية", "طبيب معروف", "معلم أو مدير مدرسة", "مسؤول جمعية", "أخرى"] },
        { id: "refName", type: "text", label: "الاسم الكامل للمرجع", required: true, binding: "ref_name" },
        { id: "refPhone", type: "tel", label: "رقم هاتف المرجع", required: true, binding: "ref_phone" },
        { id: "refRegion", type: "text", label: "منطقة المرجع", required: true, binding: "ref_region" },
        { id: "refVillage", type: "text", label: "قرية المرجع", hint: "اختياري", binding: "ref_village" },
        { id: "refKnown", type: "select", label: "منذ متى تعرفه؟", required: true, binding: "ref_known", options: ["أقل من سنة", "١–٥ سنوات", "أكثر من ٥ سنوات", "طوال عمري"] },
        { id: "refNotes", type: "textarea", label: "ملاحظات إضافية حول المرجع", hint: "اختياري", binding: "ref_notes" },
      ],
    },
    {
      id: "review",
      number_label: "٠٦",
      title: "مراجعة وتأكيد",
      fields: [
        {
          id: "confirmed",
          type: "checkbox",
          label: "أؤكد أن جميع المعلومات المقدمة صحيحة ودقيقة، وأن طلبي مشروع وحقيقي.",
          required: true,
          binding: "confirm",
        },
      ],
    },
  ],
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asOptions(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const items = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return items.length > 0 ? items : fallback;
}

function mergeVisibleWhen(raw: unknown, fallback?: AidFormVisibleWhen): AidFormVisibleWhen | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const row = raw as AidFormVisibleWhen;
  if (!row.field_id?.trim() || !row.op) return fallback;
  return { field_id: row.field_id.trim(), op: row.op, value: row.value };
}

function mergeField(raw: unknown, fallback?: AidFormField): AidFormField | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback ?? null;
  const f = raw as AidFormField;
  if (!f.id?.trim() || !f.type || !f.label?.trim()) return fallback ?? null;
  const validTypes: AidFormFieldType[] = ["text", "number", "tel", "textarea", "select", "multiselect", "toggle", "date", "checkbox"];
  if (!validTypes.includes(f.type)) return fallback ?? null;
  return {
    id: f.id.trim(),
    type: f.type,
    label: f.label.trim(),
    hint: typeof f.hint === "string" ? f.hint : fallback?.hint,
    required: asBool(f.required, fallback?.required ?? false),
    placeholder: typeof f.placeholder === "string" ? f.placeholder : fallback?.placeholder,
    options: f.options ? asOptions(f.options, fallback?.options ?? []) : fallback?.options,
    binding: f.binding ?? fallback?.binding,
    parent_option: typeof f.parent_option === "string" ? f.parent_option : fallback?.parent_option,
    visible_when: mergeVisibleWhen(f.visible_when, fallback?.visible_when),
    visible_when_any: Array.isArray(f.visible_when_any)
      ? (f.visible_when_any.map((w) => mergeVisibleWhen(w)).filter(Boolean) as AidFormVisibleWhen[])
      : fallback?.visible_when_any,
    min_length: typeof f.min_length === "number" ? f.min_length : fallback?.min_length,
    min: typeof f.min === "number" ? f.min : fallback?.min,
    max: typeof f.max === "number" ? f.max : fallback?.max,
  };
}

function mergeSection(raw: unknown, fallback?: AidFormSection): AidFormSection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback ?? null;
  const s = raw as AidFormSection;
  if (!s.id?.trim() || !s.title?.trim()) return fallback ?? null;
  const fallbackFields = fallback?.fields ?? [];
  const fieldsRaw = Array.isArray(s.fields) ? s.fields : [];
  const fields: AidFormField[] = [];
  for (let i = 0; i < fieldsRaw.length; i++) {
    const merged = mergeField(fieldsRaw[i], fallbackFields[i]);
    if (merged) fields.push(merged);
  }
  if (fields.length === 0 && fallbackFields.length > 0) return { ...fallback!, fields: fallbackFields };
  if (fields.length === 0) return null;
  return {
    id: s.id.trim(),
    title: s.title.trim(),
    subtitle: typeof s.subtitle === "string" ? s.subtitle : fallback?.subtitle,
    number_label: asString(s.number_label, fallback?.number_label ?? "٠١"),
    fields,
  };
}

export function mergeAidFormSchema(raw: unknown): AidFormSchema {
  const base = DEFAULT_AID_FORM_SCHEMA;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Partial<AidFormSchema>;
  const sectionsRaw = Array.isArray(r.sections) ? r.sections : [];
  if (sectionsRaw.length === 0) return base;
  const sections: AidFormSection[] = [];
  for (let i = 0; i < sectionsRaw.length; i++) {
    const merged = mergeSection(sectionsRaw[i], base.sections[i]);
    if (merged) sections.push(merged);
  }
  if (sections.length === 0) return base;
  return {
    version: typeof r.version === "number" ? r.version : base.version,
    sections,
  };
}

export function allAidFormFields(schema: AidFormSchema): AidFormField[] {
  return schema.sections.flatMap((s) => s.fields);
}

export function findAidFormField(schema: AidFormSchema, fieldId: string): AidFormField | undefined {
  return allAidFormFields(schema).find((f) => f.id === fieldId);
}

let cachedSchema: AidFormSchema | null = null;
let cachePromise: Promise<AidFormSchema> | null = null;

export function clearAidFormSchemaCache(): void {
  cachedSchema = null;
  cachePromise = null;
}

export function cloneDefaultAidFormSchema(): AidFormSchema {
  return structuredClone(DEFAULT_AID_FORM_SCHEMA);
}

export async function fetchAidFormSchema(force = false): Promise<AidFormSchema> {
  if (force) clearAidFormSchemaCache();
  if (cachedSchema) return cachedSchema;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const { data, error } = await supabase.rpc("get_aid_form_schema");
    if (error) {
      if (import.meta.env.DEV) console.warn("[AidFormSchema] RPC failed, using defaults:", error);
      cachedSchema = DEFAULT_AID_FORM_SCHEMA;
      return cachedSchema;
    }
    cachedSchema = mergeAidFormSchema(data);
    return cachedSchema;
  })();

  try {
    return await cachePromise;
  } finally {
    cachePromise = null;
  }
}

export async function saveAidFormSchema(schema: AidFormSchema): Promise<number> {
  const { data, error } = await supabase.rpc("save_aid_form_schema", {
    _schema: schema as unknown as Json,
  });
  if (error) throw error;
  cachedSchema = mergeAidFormSchema(schema);
  return Number(data ?? 0);
}

export function newFieldId(): string {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newSectionId(): string {
  return `section_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const AID_FORM_FIELD_TYPE_LABELS: Record<AidFormFieldType, string> = {
  text: "نص",
  number: "رقم",
  tel: "هاتف",
  textarea: "نص طويل",
  select: "قائمة منسدلة",
  multiselect: "اختيار متعدد (شرائح)",
  toggle: "نعم/لا",
  date: "تاريخ",
  checkbox: "مربّع تأكيد",
};

/** Core bindings that must stay required — cannot be removed/unrequired in form-settings. */
export const LOCKED_AID_FORM_BINDINGS: readonly AidFormFieldBinding[] = [
  "first_name",
  "father_name",
  "family_name",
  "phone",
  "needs",
  "ref_type",
  "ref_name",
  "ref_phone",
  "ref_region",
  "ref_known",
  "confirm",
] as const;

export const CORE_REFERENCE_BINDINGS: readonly AidFormFieldBinding[] = [
  "ref_type",
  "ref_name",
  "ref_phone",
  "ref_region",
  "ref_known",
] as const;

export function isLockedAidFormBinding(binding?: AidFormFieldBinding): boolean {
  return !!binding && (LOCKED_AID_FORM_BINDINGS as readonly string[]).includes(binding);
}

export function isCoreReferenceBinding(binding?: AidFormFieldBinding): boolean {
  return !!binding && (CORE_REFERENCE_BINDINGS as readonly string[]).includes(binding);
}
