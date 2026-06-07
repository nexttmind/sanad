/** Source of truth for validation logic. Dashboard deploy uses inlined copy in each function's index.ts — sync when editing. */

export function normalizeLebanesePhone(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) return `961${digits.slice(1)}`;
  return `961${digits}`;
}

export function normalizeNationalId(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim().replace(/[\s-]/g, "").toUpperCase();
}

export type DocumentType = "lebanese_id" | "passport";

export function validateDocumentNumberFormat(
  documentType: DocumentType | string | null | undefined,
  raw: string | null | undefined,
): boolean {
  if (!documentType || !raw || !String(raw).trim()) return false;
  if (documentType === "lebanese_id") {
    const digits = String(raw).replace(/\D/g, "");
    return /^\d{7,8}$/.test(digits);
  }
  if (documentType === "passport") {
    const normalized = normalizeNationalId(raw);
    return normalized != null && /^[A-Z]{2}\d{7}$/.test(normalized);
  }
  return false;
}

export function isLebanesePhone(v: string): boolean {
  const s = v.replace(/[\s-]/g, "");
  return /^(?:\+?961|0)?(3|70|71|76|78|79|81)\d{6}$/.test(s);
}

export const VALIDATION_MESSAGES = {
  invalidLebaneseId: "رقم الهوية يجب أن يكون ٧ أو ٨ أرقام.",
  invalidPassport: "رقم الجواز يجب أن يكون حرفين متبوعين بـ ٧ أرقام (مثال: RL1234567).",
  invalidDocumentType: "يرجى اختيار نوع الوثيقة: بطاقة هوية لبنانية أو جواز سفر.",
} as const;

export type AidRequestServerBody = {
  full_name?: string;
  phone?: string;
  alt_phone?: string | null;
  national_id?: string | null;
  document_type?: string | null;
  needs?: string[];
  family_size?: number;
};

export function validateAidRequestServerBody(body: AidRequestServerBody): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.full_name?.trim()) errors.full_name = "يرجى إدخال الاسم.";
  if (!body.phone?.trim()) errors.phone = "يرجى إدخال رقم الهاتف.";
  else if (!isLebanesePhone(body.phone)) {
    errors.phone = "يرجى التحقق — رقم لبناني صحيح يبدأ بـ 03 أو 70 أو 71 أو 76 أو 78 أو 79 أو 81";
  }

  if (body.alt_phone?.trim() && !isLebanesePhone(body.alt_phone)) {
    errors.alt_phone = "يرجى التحقق من صيغة الرقم الثانوي";
  }

  const docType = body.document_type as DocumentType | null;
  if (!docType || (docType !== "lebanese_id" && docType !== "passport")) {
    errors.document_type = VALIDATION_MESSAGES.invalidDocumentType;
  } else if (!body.national_id?.trim()) {
    errors.national_id = "يرجى إدخال رقم الوثيقة";
  } else if (!validateDocumentNumberFormat(docType, body.national_id)) {
    errors.national_id = docType === "passport"
      ? VALIDATION_MESSAGES.invalidPassport
      : VALIDATION_MESSAGES.invalidLebaneseId;
  }

  if (!Array.isArray(body.needs) || body.needs.length === 0) {
    errors.needs = "يرجى اختيار حاجة واحدة على الأقل";
  }

  if ((body.family_size ?? 0) < 1) errors.family_size = "يرجى إدخال عدد أفراد العائلة";

  return errors;
}

export function hashIdentifier(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return `ip_${Math.abs(h)}`;
}
