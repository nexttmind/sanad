/** Deno mirror of src/lib/aid-request-validation server rules */

export function isLebanesePhone(v: string): boolean {
  const s = v.replace(/[\s-]/g, "");
  return /^(?:\+?961|0)?(3|70|71|76|78|79|81)\d{6}$/.test(s);
}

export type AidRequestServerBody = {
  full_name?: string;
  phone?: string;
  alt_phone?: string | null;
  needs?: string[];
  family_size?: number;
  reference?: {
    reference_type?: string;
    full_name?: string;
    phone?: string;
    region?: string | null;
    village?: string | null;
    known_duration?: string | null;
    notes?: string | null;
  };
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

  if (!Array.isArray(body.needs) || body.needs.length === 0) {
    errors.needs = "يرجى اختيار حاجة واحدة على الأقل";
  }

  if ((body.family_size ?? 0) < 1) errors.family_size = "يرجى إدخال عدد أفراد العائلة";

  const ref = body.reference;
  if (!ref?.reference_type?.trim()) errors.ref_type = "يرجى اختيار نوع المرجع";
  if (!ref?.full_name?.trim()) errors.ref_name = "يرجى إدخال اسم المرجع";
  if (!ref?.phone?.trim()) errors.ref_phone = "يرجى إدخال رقم هاتف المرجع";
  else if (!isLebanesePhone(ref.phone)) errors.ref_phone = "يرجى التحقق من صيغة رقم المرجع";
  if (!ref?.region?.trim()) errors.ref_region = "يرجى إدخال منطقة المرجع";
  if (!ref?.known_duration?.trim()) errors.ref_known = "يرجى تحديد منذ متى تعرفه";

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
