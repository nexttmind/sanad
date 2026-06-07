/** Must match `public.normalize_lebanese_phone` in SQL migration. */
export function normalizeLebanesePhone(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) return `961${digits.slice(1)}`;
  return `961${digits}`;
}

/** Must match `public.normalize_national_id` in SQL migration. */
export function normalizeNationalId(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim().replace(/[\s-]/g, "").toUpperCase();
}

export type DocumentType = "lebanese_id" | "passport";

/** Must match `public.validate_document_number` in SQL migration. */
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

/** Lebanese mobile: 03, 70, 71, 76, 78, 79, 81 + 6 digits. */
export function isLebanesePhone(v: string): boolean {
  const s = v.replace(/[\s-]/g, "");
  return /^(?:\+?961|0)?(3|70|71|76|78|79|81)\d{6}$/.test(s);
}

export const DOC_TYPE_LABELS = {
  lebanese_id: "بطاقة الهوية اللبنانية",
  passport: "جواز السفر",
} as const;

export function documentTypeFromLabel(label: string): DocumentType | null {
  if (label === DOC_TYPE_LABELS.lebanese_id) return "lebanese_id";
  if (label === DOC_TYPE_LABELS.passport) return "passport";
  return null;
}

export function maskReferenceCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper.length <= 4) return upper;
  return "*".repeat(upper.length - 4) + upper.slice(-4);
}
