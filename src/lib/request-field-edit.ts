import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/audit-log";
import { isLebPhone } from "@/lib/mukhtar-whitelist";
import type { AidRowExtended } from "@/lib/request-detail-types";

export type EditableRequestFields = {
  phone: string;
  alt_phone: string;
  governorate: string;
  town: string;
  housing_type: string;
  current_address: string;
  origin_town: string;
  displaced: boolean;
  displacement_date: string;
  family_size: number;
  infants: number;
  children: number;
  elderly: number;
  disabled: boolean;
  chronic_illness: boolean;
  pregnant_or_nursing: boolean;
  needs: string[];
  needs_other: string;
};

export function requestToEditableFields(row: AidRowExtended): EditableRequestFields {
  return {
    phone: row.phone ?? "",
    alt_phone: row.alt_phone ?? "",
    governorate: row.governorate ?? "",
    town: row.town ?? "",
    housing_type: row.housing_type ?? "",
    current_address: row.current_address ?? "",
    origin_town: row.origin_town ?? "",
    displaced: Boolean(row.displaced),
    displacement_date: row.displacement_date ?? "",
    family_size: row.family_size ?? 1,
    infants: row.infants ?? 0,
    children: row.children ?? 0,
    elderly: row.elderly ?? 0,
    disabled: Boolean(row.disabled),
    chronic_illness: Boolean(row.chronic_illness),
    pregnant_or_nursing: Boolean(row.pregnant_or_nursing),
    needs: [...(row.needs ?? [])],
    needs_other: row.needs_other ?? "",
  };
}

export function validateEditableFields(
  fields: EditableRequestFields,
  section?: "personal" | "family" | "location" | "needs",
): Record<string, string> {
  const errors: Record<string, string> = {};

  const checkPersonal = !section || section === "personal";
  const checkFamily = !section || section === "family";
  const checkLocation = !section || section === "location";
  const checkNeeds = !section || section === "needs";

  if (checkPersonal) {
    if (!fields.phone.trim()) errors.phone = "يرجى إدخال رقم الهاتف";
    else if (!isLebPhone(fields.phone)) {
      errors.phone = "رقم لبناني صحيح (03 أو 70 أو 71 أو 76 أو 78 أو 79 أو 81)";
    }
    if (fields.alt_phone.trim() && !isLebPhone(fields.alt_phone)) {
      errors.alt_phone = "يرجى التحقق من صيغة الرقم البديل";
    }
  }

  if (checkFamily) {
    if (fields.family_size < 1) errors.family_size = "حجم العائلة يجب أن يكون 1 على الأقل";
    if (fields.infants < 0) errors.infants = "قيمة غير صالحة";
    if (fields.children < 0) errors.children = "قيمة غير صالحة";
    if (fields.elderly < 0) errors.elderly = "قيمة غير صالحة";
  }

  if (checkLocation) {
    if (fields.displaced && !fields.displacement_date) {
      errors.displacement_date = "تاريخ النزوح مطلوب للنازحين";
    }
    if (fields.displacement_date) {
      const t = new Date(fields.displacement_date).getTime();
      if (Number.isNaN(t) || t > Date.now()) {
        errors.displacement_date = "تاريخ غير صالح";
      }
    }
  }

  if (checkNeeds && fields.needs.length === 0) {
    errors.needs = "اختر حاجة واحدة على الأقل";
  }

  return errors;
}

const PATCH_KEYS: (keyof EditableRequestFields)[] = [
  "phone",
  "alt_phone",
  "governorate",
  "town",
  "housing_type",
  "current_address",
  "origin_town",
  "displaced",
  "displacement_date",
  "family_size",
  "infants",
  "children",
  "elderly",
  "disabled",
  "chronic_illness",
  "pregnant_or_nursing",
  "needs",
  "needs_other",
];

function normalizeForCompare(key: keyof EditableRequestFields, value: unknown): unknown {
  if (key === "needs") return Array.isArray(value) ? [...value].sort() : [];
  if (key === "alt_phone" || key === "needs_other" || key === "displacement_date") {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  if (
    key === "governorate" ||
    key === "town" ||
    key === "housing_type" ||
    key === "current_address" ||
    key === "origin_town"
  ) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  return value;
}

export function diffEditableFields(
  before: EditableRequestFields,
  after: EditableRequestFields,
  keys?: (keyof EditableRequestFields)[],
): { old_value: Record<string, unknown>; new_value: Record<string, unknown> } {
  const old_value: Record<string, unknown> = {};
  const new_value: Record<string, unknown> = {};
  const scope = keys ?? PATCH_KEYS;

  for (const key of scope) {
    const prev = normalizeForCompare(key, before[key]);
    const next = normalizeForCompare(key, after[key]);
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      old_value[key] = prev;
      new_value[key] = next;
    }
  }

  return { old_value, new_value };
}

export function editableFieldsToPatch(fields: EditableRequestFields): Record<string, unknown> {
  return {
    phone: fields.phone.trim(),
    alt_phone: fields.alt_phone.trim() || null,
    governorate: fields.governorate.trim() || null,
    town: fields.town.trim() || null,
    housing_type: fields.housing_type.trim() || null,
    current_address: fields.current_address.trim() || null,
    origin_town: fields.origin_town.trim() || null,
    displaced: fields.displaced,
    displacement_date: fields.displaced && fields.displacement_date ? fields.displacement_date : null,
    family_size: fields.family_size,
    infants: fields.infants,
    children: fields.children,
    elderly: fields.elderly,
    disabled: fields.disabled,
    chronic_illness: fields.chronic_illness,
    pregnant_or_nursing: fields.pregnant_or_nursing,
    needs: fields.needs,
    needs_other: fields.needs_other.trim() || null,
  };
}

export type UpdateRequestFieldsResult =
  | { ok: true; changed: string[] }
  | { ok: false; message: string; errors?: Record<string, string> };

export async function updateRequestFields(params: {
  requestId: string;
  referenceCode: string;
  before: AidRowExtended;
  after: EditableRequestFields;
  section?: "personal" | "family" | "location" | "needs";
  actorName: string;
}): Promise<UpdateRequestFieldsResult> {
  const errors = validateEditableFields(params.after, params.section);
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "يرجى تصحيح الحقول المحدّدة.", errors };
  }

  const beforeFields = requestToEditableFields(params.before);
  const sectionKeys: Record<string, (keyof EditableRequestFields)[]> = {
    personal: ["phone", "alt_phone"],
    family: [
      "family_size",
      "infants",
      "children",
      "elderly",
      "disabled",
      "chronic_illness",
      "pregnant_or_nursing",
    ],
    location: [
      "governorate",
      "town",
      "housing_type",
      "current_address",
      "origin_town",
      "displaced",
      "displacement_date",
    ],
    needs: ["needs", "needs_other"],
  };

  const keys = params.section ? sectionKeys[params.section] : PATCH_KEYS;
  const { old_value, new_value } = diffEditableFields(beforeFields, params.after, keys);

  if (Object.keys(new_value).length === 0) {
    return { ok: false, message: "لا توجد تغييرات للحفظ." };
  }

  const patch = editableFieldsToPatch(params.after);
  const dbPatch: Record<string, unknown> = {};
  for (const key of Object.keys(new_value)) {
    dbPatch[key] = patch[key];
  }

  const { error } = await supabase
    .from("aid_requests")
    .update(dbPatch as Database["public"]["Tables"]["aid_requests"]["Update"])
    .eq("id", params.requestId);
  if (error) {
    if (import.meta.env.DEV) console.error("[FieldEdit] update failed:", error);
    return { ok: false, message: "تعذّر حفظ التعديلات." };
  }

  await logAdminAction({
    action: "field_updated",
    entityId: params.requestId,
    oldValue: old_value,
    newValue: new_value,
    metadata: { reference_code: params.referenceCode, section: params.section ?? "all" },
    actorName: params.actorName,
  });

  return { ok: true, changed: Object.keys(new_value) };
}
