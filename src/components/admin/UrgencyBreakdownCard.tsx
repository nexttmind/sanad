import {
  CATEGORY_LABELS,
  parseUrgencyBreakdown,
  reasonLabel,
  TIER_BADGE_CLASS,
  TIER_LABELS,
  type CategoryKey,
  type UrgencyTier,
  urgencyBarColor,
  urgencyScoreColor,
} from "@/lib/scoring";

type Props = {
  urgencyScore: number;
  effectiveUrgency?: number | null;
  urgencyTier?: UrgencyTier | string | null;
  breakdown: unknown;
  manualUrgency?: number | null;
  manualReason?: string | null;
};

const CATEGORY_ORDER: CategoryKey[] = [
  "shelter",
  "medical",
  "dependents",
  "displacement",
  "household",
  "reference",
];

export function UrgencyBreakdownCard({
  urgencyScore,
  effectiveUrgency,
  urgencyTier,
  breakdown,
  manualUrgency,
  manualReason,
}: Props) {
  const parsed = parseUrgencyBreakdown(breakdown);
  const displayScore = effectiveUrgency ?? urgencyScore;
  const tier = (urgencyTier ?? parsed?.tier ?? "medium") as UrgencyTier;
  const tierLabel = TIER_LABELS[tier] ?? tier;
  const tierClass = TIER_BADGE_CLASS[tier] ?? TIER_BADGE_CLASS.medium;

  return (
    <div className="space-y-4">
      {manualUrgency != null && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          تم تعديل العجلة يدوياً — {manualReason || "بدون سبب مسجّل"}
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-3">
        <div className={["font-display text-5xl", urgencyScoreColor(displayScore)].join(" ")}>
          {displayScore}
        </div>
        <span className={["inline-flex rounded-full border px-2.5 py-0.5 text-[11px]", tierClass].join(" ")}>
          {tierLabel}
        </span>
        {effectiveUrgency != null && effectiveUrgency !== urgencyScore && (
          <span className="text-[11px] text-muted-foreground">
            محسوب: {urgencyScore}
          </span>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={["h-full", urgencyBarColor(displayScore)].join(" ")}
          style={{ width: `${displayScore}%` }}
        />
      </div>

      {parsed && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>المجموع الخام: {parsed.raw_total}</span>
            <span>بعد التطبيع: {parsed.normalized}</span>
          </div>
          {CATEGORY_ORDER.map((key) => {
            const cat = parsed.categories[key];
            if (!cat) return null;
            const pct = cat.max > 0 ? (cat.points / cat.max) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs">
                  <span>{CATEGORY_LABELS[key]}</span>
                  <span className="font-mono text-muted-foreground">
                    {cat.points}/{cat.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-clay" style={{ width: `${pct}%` }} />
                </div>
                {cat.reasons.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cat.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {reasonLabel(r)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
