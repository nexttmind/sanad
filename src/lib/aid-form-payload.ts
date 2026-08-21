import type { AidRequestSubmitPayload } from "@/lib/submit-aid-request";
import {
  allAidFormFields,
  type AidFormSchema,
} from "@/lib/aid-form-schema";
import { isAidFormFieldVisible, type AidFormValues, valueByBinding } from "@/lib/aid-form-validation";

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function bool(v: unknown): boolean {
  return v === true;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export type AidFormReferencePayload = {
  reference_type: string;
  full_name: string;
  phone: string;
  region: string | null;
  village: string | null;
  known_duration: string | null;
  notes: string | null;
};

export function buildAidFormSubmitPayload(
  schema: AidFormSchema,
  values: AidFormValues,
  meta: {
    submission_seconds?: number | null;
    user_agent?: string | null;
    device_fingerprint?: string | null;
  },
): { payload: AidRequestSubmitPayload; form_responses: Record<string, unknown> } {
  const first = str(valueByBinding(schema, values, "first_name"));
  const father = str(valueByBinding(schema, values, "father_name"));
  const family = str(valueByBinding(schema, values, "family_name"));
  const fullName = [first, father, family].map((s) => s.trim()).filter(Boolean).join(" ");

  const phone = str(valueByBinding(schema, values, "phone")).trim();
  const altPhone = str(valueByBinding(schema, values, "alt_phone")).trim();

  const displaced = bool(valueByBinding(schema, values, "displaced"));
  const origin = str(valueByBinding(schema, values, "origin"));
  const originVillage = str(valueByBinding(schema, values, "origin_village"));
  const currentLoc = str(valueByBinding(schema, values, "current_loc"));
  const shelter = str(valueByBinding(schema, values, "shelter"));
  const shelterName = str(valueByBinding(schema, values, "shelter_name"));
  const showSchoolName = shelter === "مدرسة" || shelter === "مأوى جماعي";

  const hasElderly = bool(valueByBinding(schema, values, "has_elderly"));
  const hasDisabled = bool(valueByBinding(schema, values, "has_disabled"));
  const hasChronic = bool(valueByBinding(schema, values, "has_chronic"));
  const disabledDesc = str(valueByBinding(schema, values, "disabled_desc"));
  const chronicDesc = str(valueByBinding(schema, values, "chronic_desc"));
  const notesField = str(valueByBinding(schema, values, "notes"));

  const needsField = allAidFormFields(schema).find((f) => f.binding === "needs");
  const needs = needsField ? strArr(values[needsField.id]) : [];
  const hasNeed = (n: string) => needs.includes(n);

  const diaperSize = str(valueByBinding(schema, values, "diaper_size"));
  const milkBrand = str(valueByBinding(schema, values, "milk_brand"));
  const milkStage = str(valueByBinding(schema, values, "milk_stage"));
  const clothesDesc = str(valueByBinding(schema, values, "clothes_desc"));
  const otherDesc = str(valueByBinding(schema, values, "other_desc"));

  const needsAll = [
    ...needs,
    hasNeed("حفاضات") && diaperSize ? `حفاضات:${diaperSize}` : null,
    hasNeed("حليب أطفال") && milkBrand ? `حليب:${milkBrand}/${milkStage}` : null,
    hasNeed("ملابس") && clothesDesc ? `ملابس:${clothesDesc.slice(0, 120)}` : null,
    hasNeed("أخرى") && otherDesc ? `أخرى:${otherDesc.slice(0, 200)}` : null,
  ].filter(Boolean) as string[];

  const refRegion = str(valueByBinding(schema, values, "ref_region"));

  const form_responses: Record<string, unknown> = {};
  for (const field of allAidFormFields(schema)) {
    if (field.binding || field.type === "checkbox") continue;
    if (!isAidFormFieldVisible(field, values, schema)) continue;
    const v = values[field.id];
    if (v === "" || v === false || (Array.isArray(v) && v.length === 0)) continue;
    form_responses[field.id] = { label: field.label, value: v };
  }

  for (const field of allAidFormFields(schema)) {
    if (!field.binding) continue;
    if (isAidFormFieldVisible(field, values, schema)) continue;
    const v = values[field.id];
    if (v === "" || v === false || (Array.isArray(v) && v.length === 0)) continue;
    form_responses[`hidden_${field.id}`] = { label: field.label, value: v };
  }

  const payload: AidRequestSubmitPayload = {
    full_name: fullName,
    phone,
    alt_phone: altPhone || null,
    governorate: origin || null,
    district: refRegion || null,
    town: originVillage || currentLoc || null,
    current_address: currentLoc || null,
    housing_type: shelter ? (showSchoolName && shelterName ? `${shelter} — ${shelterName}` : shelter) : null,
    family_size: Math.max(1, Number(valueByBinding(schema, values, "family_size")) || 1),
    infants: Math.max(0, Number(valueByBinding(schema, values, "infants")) || 0),
    children: Math.max(0, Number(valueByBinding(schema, values, "children")) || 0),
    elderly: hasElderly ? Math.max(0, Number(valueByBinding(schema, values, "elderly_count")) || 0) : 0,
    disabled: hasDisabled,
    chronic_illness: hasChronic,
    pregnant_or_nursing: bool(valueByBinding(schema, values, "pregnant_or_nursing")),
    displaced,
    displacement_date: displaced ? str(valueByBinding(schema, values, "displacement_date")) || null : null,
    origin_town: originVillage || null,
    needs: needsAll,
    needs_other: otherDesc || null,
    notes:
      [
        notesField,
        hasDisabled && disabledDesc ? `إعاقة: ${disabledDesc}` : "",
        hasChronic && chronicDesc ? `مزمن: ${chronicDesc}` : "",
      ]
        .filter(Boolean)
        .join("\n") || null,
    submission_seconds: meta.submission_seconds ?? null,
    user_agent: meta.user_agent ?? null,
    device_fingerprint: meta.device_fingerprint ?? null,
    form_responses: Object.keys(form_responses).length > 0 ? form_responses : undefined,
    reference: {
      reference_type: str(valueByBinding(schema, values, "ref_type")),
      full_name: str(valueByBinding(schema, values, "ref_name")).trim(),
      phone: str(valueByBinding(schema, values, "ref_phone")).trim(),
      region: str(valueByBinding(schema, values, "ref_region")).trim() || null,
      village: str(valueByBinding(schema, values, "ref_village")).trim() || null,
      known_duration: str(valueByBinding(schema, values, "ref_known")) || null,
      notes: str(valueByBinding(schema, values, "ref_notes")).trim() || null,
    },
  };

  return { payload, form_responses };
}

export function buildAidFormReferencePayload(
  schema: AidFormSchema,
  values: AidFormValues,
): AidFormReferencePayload {
  return {
    reference_type: str(valueByBinding(schema, values, "ref_type")),
    full_name: str(valueByBinding(schema, values, "ref_name")).trim(),
    phone: str(valueByBinding(schema, values, "ref_phone")).trim(),
    region: str(valueByBinding(schema, values, "ref_region")).trim() || null,
    village: str(valueByBinding(schema, values, "ref_village")).trim() || null,
    known_duration: str(valueByBinding(schema, values, "ref_known")) || null,
    notes: str(valueByBinding(schema, values, "ref_notes")).trim() || null,
  };
}

export function buildReviewSummary(
  schema: AidFormSchema,
  values: AidFormValues,
): { label: string; value: string; anchor: string }[] {
  return schema.sections
    .filter((s) => s.id !== "review")
    .map((section) => {
      let value = "—";
      if (section.id === "personal") {
        const parts = ["first_name", "father_name", "family_name"].map((b) =>
          str(valueByBinding(schema, values, b)).trim(),
        );
        value = parts.filter(Boolean).join(" ") || "—";
      } else if (section.id === "family") {
        const total = str(valueByBinding(schema, values, "family_size"));
        const infants = str(valueByBinding(schema, values, "infants"));
        value = `${total || 0} فرد${infants ? ` — ${infants} رضيع` : ""}`;
      } else if (section.id === "displacement") {
        const displaced = bool(valueByBinding(schema, values, "displaced"));
        if (!displaced) value = "غير نازح";
        else {
          const origin = str(valueByBinding(schema, values, "origin"));
          const loc = str(valueByBinding(schema, values, "current_loc"));
          const shelter = str(valueByBinding(schema, values, "shelter"));
          value = `${origin || "—"} → ${loc || "—"}${shelter ? ` (${shelter})` : ""}`;
        }
      } else if (section.id === "needs") {
        const needs = strArr(valueByBinding(schema, values, "needs"));
        value = needs.length ? needs.join("، ") : "—";
      } else if (section.id === "reference") {
        const name = str(valueByBinding(schema, values, "ref_name"));
        const type = str(valueByBinding(schema, values, "ref_type"));
        value = name ? `${name}${type ? ` (${type})` : ""}` : "—";
      }
      return { label: section.title, value, anchor: `sec-${section.id}` };
    });
}
