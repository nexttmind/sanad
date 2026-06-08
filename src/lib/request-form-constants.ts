/** Shared options aligned with the public request form. */
export const GOVERNORATE_OPTIONS = [
  "قضاء صور",
  "قضاء بنت جبيل",
  "قضاء مرجعيون",
  "قضاء النبطية",
  "قضاء حاصبيا",
  "منطقة أخرى",
] as const;

export const SHELTER_OPTIONS = [
  "مدرسة",
  "مأوى جماعي",
  "عند أهل أو أصدقاء",
  "منزل مستأجر",
  "أخرى",
] as const;

export const NEED_OPTIONS = [
  "طعام",
  "ملابس",
  "أدوية",
  "وسائد وفرش",
  "حفاضات",
  "حليب أطفال",
  "مروحة",
  "غاز",
  "مساعدة مالية",
  "مواد نظافة",
  "أغطية وبطانيات",
  "أخرى",
] as const;

export const EDITABLE_FIELD_LABELS: Record<string, string> = {
  phone: "الهاتف الأساسي",
  alt_phone: "هاتف بديل",
  governorate: "المحافظة",
  town: "البلدة",
  housing_type: "نوع المأوى",
  current_address: "العنوان الحالي",
  origin_town: "مكان الاقامة قبل النزوح",
  displaced: "نازح",
  displacement_date: "تاريخ النزوح",
  family_size: "حجم العائلة",
  infants: "رضّع",
  children: "أطفال",
  elderly: "كبار سن",
  disabled: "ذوو إعاقة",
  chronic_illness: "مرض مزمن",
  pregnant_or_nursing: "حامل/مرضع",
  needs: "الاحتياجات",
  needs_other: "احتياجات أخرى",
};
