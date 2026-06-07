/** Single field photo — used on the public aid-request page hero only. */
import aidRequestHeroPhoto from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.56 PM (1).jpeg";
import sanadLogoPhoto from "@/assets/photos and proofs/sanad-logo.png.jpeg";

export { aidRequestHeroPhoto, sanadLogoPhoto };

import p01 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 1.56.50 PM.jpeg";
import p02 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 1.56.55 PM.jpeg";
import p03 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.49 PM.jpeg";
import p04 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.49 PM (1).jpeg";
import p05 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.49 PM (2).jpeg";
import p06 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.51 PM.jpeg";
import p07 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.52 PM.jpeg";
import p08 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.53 PM.jpeg";
import p09 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.53 PM (1).jpeg";
import p10 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.53 PM (2).jpeg";
import p11 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.53 PM (3).jpeg";
import p12 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.53 PM (4).jpeg";
import p13 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.54 PM.jpeg";
import p14 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.54 PM (1).jpeg";
import p15 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.54 PM (2).jpeg";
import p16 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.54 PM (3).jpeg";
import p17 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.54 PM (4).jpeg";
import p18 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.55 PM.jpeg";
import p19 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.55 PM (1).jpeg";
import p20 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.55 PM (2).jpeg";
import p21 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.55 PM (3).jpeg";
import p22 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.55 PM (4).jpeg";
import p23 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.55 PM (5).jpeg";
import p24 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.56 PM.jpeg";
import p25 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.56 PM (2).jpeg";
import p26 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.56 PM (3).jpeg";
import p27 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.57 PM.jpeg";
import p28 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.57 PM (1).jpeg";
import p29 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.57 PM (2).jpeg";
import p30 from "@/assets/photos and proofs/WhatsApp Image 2026-06-02 at 3.57.57 PM (3).jpeg";

export type DonationJourneyPhoto = { src: string; caption: string };
export type DonationJourneyStage = {
  id: string;
  step: string;
  title: string;
  description: string;
  photos: DonationJourneyPhoto[];
};

export const donationJourneyStages: DonationJourneyStage[] = [
  {
    id: "receive",
    step: "٠١",
    title: "استلام التبرع",
    description: "كل مساهمة تُسجَّل وتُوجَّه مباشرةً إلى صندوق العائلات المعتمدة — بلا وسطاء.",
    photos: [
      { src: p01, caption: "تسجيل التبرعات الواردة" },
      { src: p02, caption: "فرز المبالغ حسب الأولوية" },
    ],
  },
  {
    id: "purchase",
    step: "٠٢",
    title: "شراء المواد",
    description: "فريقنا يشتري الطعام والدواء والمستلزمات من موردين محليين بأسعار شفّافة.",
    photos: [
      { src: p03, caption: "شراء المواد الغذائية" },
      { src: p04, caption: "اختيار المنتجات الأساسية" },
      { src: p05, caption: "فاتورة الشراء الفعلية" },
    ],
  },
  {
    id: "prepare",
    step: "٠٣",
    title: "تحضير الطرود",
    description: "نُجهِّز كل طرد حسب حاجة العائلة: حجم الأسرة، نوع المأوى، قائمة الاحتياجات.",
    photos: [
      { src: p06, caption: "تجهيز السلال الغذائية" },
      { src: p07, caption: "فرز المستلزمات حسب العائلة" },
      { src: p08, caption: "تعبئة الطرود" },
      { src: p09, caption: "مراجعة محتويات كل طرد" },
      { src: p10, caption: "إغلاق وتغليف آمن" },
      { src: p11, caption: "وضع ملصقات التعريف" },
      { src: p12, caption: "جاهزة للإرسال" },
    ],
  },
  {
    id: "transit",
    step: "٠٤",
    title: "النقل الميداني",
    description: "الطرود تُحمَّل وتُنقَل إلى قضاء صور والمناطق المجاورة عبر فريقنا الميداني.",
    photos: [
      { src: p13, caption: "تحميل الشحنة" },
      { src: p14, caption: "انطلاق الفريق" },
      { src: p15, caption: "في الطريق إلى الميدان" },
      { src: p16, caption: "وصول نقطة التوزيع" },
      { src: p17, caption: "تفريغ المساعدات" },
    ],
  },
  {
    id: "distribute",
    step: "٠٥",
    title: "التوزيع على العائلات",
    description: "كل طرد يصل إلى العائلة المعتمدة التي اخترتها — أو إلى قائمة الأولوية إن لم تُحدِّد.",
    photos: [
      { src: p18, caption: "استقبال العائلات" },
      { src: p19, caption: "تسليم السلة الغذائية" },
      { src: p20, caption: "توزيع المستلزمات الطبية" },
      { src: p21, caption: "مساعدة كبار السن" },
      { src: p22, caption: "عائلة تستلم طردها" },
      { src: p23, caption: "فرحة الاستلام" },
      { src: p24, caption: "متابعة احتياجات إضافية" },
      { src: p25, caption: "توزيع في المأوى" },
      { src: p26, caption: "لحظة التسليم" },
    ],
  },
  {
    id: "document",
    step: "٠٦",
    title: "التوثيق والشفافية",
    description: "صورة فاتورة الشراء وتوقيع العائلة — تصل إليك برمز PIN لتتأكد أن مالك وصل.",
    photos: [
      { src: p27, caption: "توقيع العائلة المستفيدة" },
      { src: p28, caption: "وثائق التسليم" },
      { src: p29, caption: "إيصال استلام موثَّق" },
      { src: p30, caption: "أرشفة الإثباتات" },
    ],
  },
];
