/** PRD v2 urgency scoring — labels, types, and breakdown parsing. */

export type UrgencyTier = "critical" | "high" | "medium" | "low";

export type CategoryKey =
  | "shelter"
  | "medical"
  | "dependents"
  | "displacement"
  | "household"
  | "reference";

export type CategoryBreakdown = {
  points: number;
  max: number;
  reasons: string[];
};

export type UrgencyBreakdown = {
  version: number;
  config_version?: number;
  categories: Partial<Record<CategoryKey, CategoryBreakdown>>;
  raw_total: number;
  normalized: number;
  tier?: UrgencyTier | string;
  effective?: number;
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  shelter: "المأوى",
  medical: "الطبّي",
  dependents: "التابعون",
  displacement: "النزوح",
  household: "حجم الأسرة",
  reference: "المرجع",
};

export const REASON_LABELS: Record<string, string> = {
  school_shelter: "مأوى مدرسي / أممي",
  informal_shelter: "مأوى غير رسمي",
  destroyed_home: "منزل مدمر",
  rented: "إيجار",
  with_relatives: "عند أقارب",
  other_housing: "مأوى آخر",
  medicine_need: "حاجة دواء",
  chronic_illness: "مرض مزمن",
  disabled: "ذوو إعاقة",
  infants: "رضّع",
  elderly: "كبار سن",
  pregnant_or_nursing: "حامل / مرضع",
  many_children: "3+ أطفال",
  infant_supplies: "حليب / حفاضات",
  displaced_7d: "نزوح ≤ 7 أيام",
  displaced_30d: "نزوح ≤ 30 يوماً",
  displaced_90d: "نزوح ≤ 90 يوماً",
  family_8plus: "أسرة 8+",
  family_6plus: "أسرة 6+",
  family_4plus: "أسرة 4+",
  reference_confirmed: "مرجع مؤكّد",
  reference_denied: "مرجع رفض (−10)",
};

export const TIER_LABELS: Record<UrgencyTier, string> = {
  critical: "حرج",
  high: "عالي",
  medium: "متوسط",
  low: "منخفض",
};

export const TIER_BADGE_CLASS: Record<UrgencyTier, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  high: "bg-warning/15 text-warning border-warning/40",
  medium: "bg-accent/15 text-accent border-accent/40",
  low: "bg-foreground/10 text-muted-foreground border-foreground/25",
};

export function parseUrgencyBreakdown(raw: unknown): UrgencyBreakdown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.normalized !== "number" || typeof d.raw_total !== "number") return null;

  const categories: Partial<Record<CategoryKey, CategoryBreakdown>> = {};
  if (d.categories && typeof d.categories === "object" && !Array.isArray(d.categories)) {
    for (const [key, val] of Object.entries(d.categories as Record<string, unknown>)) {
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const c = val as Record<string, unknown>;
      categories[key as CategoryKey] = {
        points: typeof c.points === "number" ? c.points : 0,
        max: typeof c.max === "number" ? c.max : 0,
        reasons: Array.isArray(c.reasons)
          ? c.reasons.filter((r): r is string => typeof r === "string")
          : [],
      };
    }
  }

  return {
    version: typeof d.version === "number" ? d.version : 1,
    config_version: typeof d.config_version === "number" ? d.config_version : undefined,
    categories,
    raw_total: d.raw_total,
    normalized: d.normalized,
    tier: typeof d.tier === "string" ? d.tier : undefined,
    effective: typeof d.effective === "number" ? d.effective : undefined,
  };
}

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

export function tierFromScore(score: number): UrgencyTier {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function displayUrgencyScore(
  effective: number | null | undefined,
  calculated: number,
): number {
  return effective ?? calculated;
}

export function urgencyScoreColor(score: number): string {
  if (score >= 85) return "text-destructive";
  if (score >= 70) return "text-warning";
  if (score >= 45) return "text-accent";
  return "text-muted-foreground";
}

export function urgencyBarColor(score: number): string {
  if (score >= 85) return "bg-destructive";
  if (score >= 70) return "bg-warning";
  if (score >= 45) return "bg-accent";
  return "bg-foreground/40";
}
