import { isLebanesePhone } from "@/lib/phone-normalize";

export type AidRequestFormInput = {
  first: string;
  father: string;
  family: string;
  phone: string;
  phone2: string;
  total: string;
  u12: string;
  u2: string;
  hasElderly: boolean;
  elderlyN: string;
  hasDisabled: boolean;
  disabledDesc: string;
  hasChronic: boolean;
  chronicDesc: string;
  critical: boolean;
  pregnantOrNursing: boolean;
  displaced: boolean;
  origin: string;
  originVillage: string;
  currentLoc: string;
  shelter: string;
  shelterName: string;
  showSchoolName: boolean;
  dispDate: string;
  needs: string[];
  hasNeed: (n: string) => boolean;
  diaperSize: string;
  infantAge: string;
  milkBrand: string;
  milkStage: string;
  milkAge: string;
  clothesDesc: string;
  otherDesc: string;
  refType: string;
  refName: string;
  refPhone: string;
  refRegion: string;
  refKnown: string;
};

function isPastOrToday(d: string): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}

export function validateAidRequestForm(input: AidRequestFormInput): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  const totalN = Number(input.total);
  const u12N = Number(input.u12);
  const u2N = Number(input.u2);

  if (!input.first.trim()) errors.first = "يرجى إدخال الاسم الأول";
  if (!input.father.trim()) errors.father = "يرجى إدخال اسم الأب";
  if (!input.family.trim()) errors.family = "يرجى إدخال اسم العائلة";

  if (!input.phone.trim()) errors.phone = "يرجى إدخال رقم الهاتف";
  else if (!isLebanesePhone(input.phone)) {
    errors.phone = "يرجى التحقق — رقم لبناني صحيح يبدأ بـ 03 أو 70 أو 71 أو 76 أو 78 أو 79 أو 81";
  }

  if (input.phone2.trim() && !isLebanesePhone(input.phone2)) {
    errors.phone2 = "يرجى التحقق من صيغة الرقم الثانوي";
  }

  if (!input.total || totalN < 1) errors.total = "يرجى إدخال عدد أفراد العائلة";
  if (input.u12 === "" || u12N < 0) errors.u12 = "يرجى إدخال عدد الأطفال (يمكن أن يكون صفراً)";
  if (input.u2 === "" || u2N < 0) errors.u2 = "يرجى إدخال عدد الرضّع (يمكن أن يكون صفراً)";
  if (input.u2 !== "" && input.u12 !== "" && u2N > u12N) {
    errors.u2 = "يرجى التحقق — عدد الرضّع لا يمكن أن يتجاوز عدد الأطفال";
  }

  if (input.hasElderly && (!input.elderlyN || Number(input.elderlyN) < 1)) {
    errors.elderlyN = "يرجى إدخال عدد كبار السن";
  }
  if (input.hasDisabled && input.disabledDesc.trim().length < 10) {
    errors.disabledDesc = "يرجى توضيح نوع الإعاقة (١٠ أحرف على الأقل)";
  }
  if (input.hasChronic && input.chronicDesc.trim().length < 10) {
    errors.chronicDesc = "يرجى توضيح المرض المزمن (١٠ أحرف على الأقل)";
  }

  if (input.displaced) {
    if (!input.origin) errors.origin = "يرجى اختيار قضاء";
    if (!input.originVillage.trim()) errors.originVillage = "يرجى إدخال مكان الاقامة قبل النزوح";
    if (!input.currentLoc.trim()) errors.currentLoc = "يرجى إدخال الموقع الحالي";
    if (!input.shelter) errors.shelter = "يرجى اختيار نوع المأوى";
    if (input.showSchoolName && !input.shelterName.trim()) {
      errors.shelterName = "يرجى إدخال اسم المدرسة أو المأوى";
    }
    if (!input.dispDate) errors.dispDate = "يرجى إدخال تاريخ النزوح";
    else if (!isPastOrToday(input.dispDate)) {
      errors.dispDate = "يرجى التحقق — تاريخ النزوح لا يمكن أن يكون في المستقبل";
    }
  }

  if (input.needs.length === 0) errors.needs = "يرجى اختيار حاجة واحدة على الأقل";
  if (input.hasNeed("حفاضات")) {
    if (!input.diaperSize) errors.diaperSize = "يرجى اختيار قياس الحفاض";
    if (!input.infantAge) errors.infantAge = "يرجى إدخال عمر الرضيع";
  }
  if (input.hasNeed("حليب أطفال")) {
    if (!input.milkBrand) errors.milkBrand = "يرجى اختيار ماركة الحليب";
    if (!input.milkStage) errors.milkStage = "يرجى اختيار المرحلة";
    if (!input.milkAge) errors.milkAge = "يرجى إدخال عمر الرضيع";
  }
  if (input.hasNeed("ملابس") && input.clothesDesc.trim().length < 5) {
    errors.clothesDesc = "يرجى توضيح المقاسات والأعمار";
  }
  if (input.hasNeed("أخرى") && input.otherDesc.trim().length < 5) {
    errors.otherDesc = "يرجى وصف الحاجة";
  }

  if (!input.refType) errors.refType = "يرجى اختيار نوع المرجع";
  if (!input.refName.trim()) errors.refName = "يرجى إدخال اسم المرجع";
  if (!input.refPhone.trim()) errors.refPhone = "يرجى إدخال رقم هاتف المرجع";
  else if (!isLebanesePhone(input.refPhone)) errors.refPhone = "يرجى التحقق من صيغة الرقم";
  if (!input.refRegion.trim()) errors.refRegion = "يرجى إدخال منطقة المرجع";
  if (!input.refKnown) errors.refKnown = "يرجى تحديد منذ متى تعرفه";

  return errors;
}

/** Server-side subset for edge function parity. */
export type AidRequestServerBody = {
  full_name?: string;
  phone?: string;
  alt_phone?: string | null;
  governorate?: string | null;
  district?: string | null;
  town?: string | null;
  current_address?: string | null;
  housing_type?: string | null;
  family_size?: number;
  infants?: number;
  children?: number;
  elderly?: number;
  disabled?: boolean;
  chronic_illness?: boolean;
  pregnant_or_nursing?: boolean;
  displaced?: boolean;
  displacement_date?: string | null;
  origin_town?: string | null;
  needs?: string[];
  needs_other?: string | null;
  notes?: string | null;
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

  return errors;
}
