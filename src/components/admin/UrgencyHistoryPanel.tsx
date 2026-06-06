import {
  formatHistoryTimestamp,
  urgencyTriggerLabel,
  type UrgencyHistoryRow,
} from "@/lib/urgency-history";
import { TIER_BADGE_CLASS, TIER_LABELS, type UrgencyTier } from "@/lib/scoring";

type Props = {
  rows: UrgencyHistoryRow[];
  loading?: boolean;
};

export function UrgencyHistoryPanel({ rows, loading }: Props) {
  return (
    <div className="space-y-3">
      {loading && <p className="text-xs text-muted-foreground">جارٍ التحميل...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">لا يوجد سجل احتساب بعد — جرّب «إعادة احتساب».</p>
      )}
      {!loading &&
        rows.map((row) => {
          const tierKey = row.urgency_tier as UrgencyTier;
          const tierLabel = TIER_LABELS[tierKey] ?? row.urgency_tier;
          const tierClass = TIER_BADGE_CLASS[tierKey] ?? TIER_BADGE_CLASS.medium;
          const effectiveDiffers = row.effective_urgency !== row.calculated_urgency;

          return (
            <div
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{row.effective_urgency}</span>
                  {effectiveDiffers && (
                    <span className="text-[11px] text-muted-foreground">
                      (محسوبة {row.calculated_urgency})
                    </span>
                  )}
                  <span
                    className={["rounded-full border px-2 py-0.5 text-[10px]", tierClass].join(" ")}
                  >
                    {tierLabel}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {urgencyTriggerLabel(row.triggered_by)}
                  {row.config_version > 0 && (
                    <span className="ms-2 font-mono">قواعد v{row.config_version}</span>
                  )}
                </div>
              </div>
              <time
                dateTime={row.created_at}
                className="shrink-0 text-[10px] text-muted-foreground"
                title={formatHistoryTimestamp(row.created_at)}
              >
                {formatHistoryTimestamp(row.created_at)}
              </time>
            </div>
          );
        })}
    </div>
  );
}
