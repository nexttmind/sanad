export type Status =
  | "pending"
  | "reviewing"
  | "verified"
  | "approved"
  | "distributed"
  | "rejected"
  | "duplicate"
  | "flagged";

export const STATUS_AR: Record<Status, string> = {
  pending: "قيد المراجعة",
  reviewing: "تحت المراجعة",
  verified: "تم التحقق",
  approved: "موافق عليه",
  distributed: "تم التوزيع",
  rejected: "مرفوض",
  duplicate: "مكرر",
  flagged: "موسوم",
};

export type Submission = {
  id: string;
  code: string;
  name: string;
  phone: string;
  region: string;
  village: string;
  shelter: string;
  familySize: number;
  infants: number;
  elderly: boolean;
  disabled: boolean;
  chronic: boolean;
  criticalMedicine?: boolean;
  needs: string[];
  trust: number;
  urgency: number;
  status: Status;
  flags: string[];
  submittedAt: string;
  reviewer?: string;
  tags?: string[];
};

export const submissions: Submission[] = [
  {
    id: "1",
    code: "SND-47291",
    name: "محمد علي الحسيني",
    phone: "+961 71 234 567",
    region: "قضاء بنت جبيل",
    village: "عيترون",
    shelter: "مدرسة",
    familySize: 6,
    infants: 1,
    elderly: false,
    disabled: true,
    chronic: true,
    needs: ["طعام", "حفاضات", "أدوية", "حليب أطفال"],
    trust: 74,
    urgency: 93,
    status: "pending",
    flags: ["FAST_SUBMISSION"],
    submittedAt: "2026-05-31T18:42:00Z",
    tags: ["urgent", "medical"],
  },
  {
    id: "2",
    code: "SND-38104",
    name: "فاطمة حسن نصر",
    phone: "+961 76 482 901",
    region: "قضاء صور",
    village: "القليلة",
    shelter: "مأوى",
    familySize: 4,
    infants: 0,
    elderly: true,
    disabled: false,
    chronic: false,
    needs: ["طعام", "أغطية", "مواد نظافة"],
    trust: 91,
    urgency: 68,
    status: "reviewing",
    flags: [],
    submittedAt: "2026-05-31T14:10:00Z",
    reviewer: "ليلى ع.",
    tags: ["مأوى shelter"],
  },
  {
    id: "3",
    code: "SND-29847",
    name: "أحمد خليل عيتاني",
    phone: "+961 70 998 113",
    region: "قضاء النبطية",
    village: "كفررمان",
    shelter: "عند أهل",
    familySize: 3,
    infants: 1,
    elderly: false,
    disabled: false,
    chronic: false,
    needs: ["مساعدة مالية", "حليب أطفال"],
    trust: 18,
    urgency: 55,
    status: "flagged",
    flags: ["DUPLICATE_PHONE", "VPN_DETECTED", "FAST_SUBMISSION"],
    submittedAt: "2026-05-31T09:25:00Z",
    tags: ["duplicate risk"],
  },
  {
    id: "4",
    code: "SND-19203",
    name: "زينب محمد صادق",
    phone: "+961 79 220 008",
    region: "قضاء مرجعيون",
    village: "الخيام",
    shelter: "مدرسة",
    familySize: 8,
    infants: 2,
    elderly: true,
    disabled: true,
    chronic: true,
    criticalMedicine: true,
    needs: ["طعام", "أدوية", "حفاضات", "حليب أطفال", "أغطية"],
    trust: 88,
    urgency: 100,
    status: "approved",
    flags: [],
    submittedAt: "2026-05-30T22:01:00Z",
    reviewer: "سامي ج.",
    tags: ["urgent", "medical", "priority", "school shelter"],
  },
  {
    id: "5",
    code: "SND-88471",
    name: "حسين قاسم مرتضى",
    phone: "+961 71 559 030",
    region: "قضاء حاصبيا",
    village: "حاصبيا",
    shelter: "منزل مستأجر",
    familySize: 5,
    infants: 0,
    elderly: false,
    disabled: false,
    chronic: true,
    needs: ["طعام", "أدوية", "مساعدة مالية"],
    trust: 62,
    urgency: 42,
    status: "pending",
    flags: ["DOCUMENT_BLURRY"],
    submittedAt: "2026-05-30T16:48:00Z",
    tags: ["field verify needed"],
  },
];

export const stats = {
  totalRequests: 1247,
  familiesHelped: 892,
  verificationRate: 96,
  avgResponseHours: 18,
};

export const statusColor: Record<Status, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  reviewing: "bg-accent/15 text-accent border-accent/30",
  verified: "bg-success/15 text-success border-success/30",
  approved: "bg-success/20 text-success border-success/40",
  distributed: "bg-foreground/10 text-foreground border-foreground/20",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  duplicate: "bg-muted text-muted-foreground border-border",
  flagged: "bg-destructive/15 text-destructive border-destructive/40",
};

export function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 60000);
  if (diff < 60) return `قبل ${diff} د`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}
