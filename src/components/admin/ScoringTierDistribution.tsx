import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchScoringTierDistribution, type ScoringTierDistribution } from "@/lib/scoring-config";
import { TIER_LABELS, urgencyBarColor, urgencyScoreColor, type UrgencyTier } from "@/lib/scoring";

const TIER_ORDER: UrgencyTier[] = ["critical", "high", "medium", "low"];

const TIER_SAMPLE_SCORE: Record<UrgencyTier, number> = {
  critical: 90,
  high: 75,
  medium: 50,
  low: 20,
};

export function ScoringTierDistribution() {
  const [data, setData] = useState<ScoringTierDistribution | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      setData(await fetchScoringTierDistribution());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const total = data?.total ?? 0;
  const maxCount = Math.max(1, ...TIER_ORDER.map((tier) => data?.[tier] ?? 0));

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">توزيع مستويات العجلة</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            الطلبات غير المرفوضة حسب urgency_tier — يتحدّث بعد إعادة الاحتساب الجماعي.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="text-xs text-clay hover:underline disabled:opacity-50"
        >
          تحديث
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && data && (
        <>
          <p className="text-xs text-muted-foreground">
            الإجمالي: {total.toLocaleString("ar-EG")} طلباً
          </p>
          <div className="space-y-3">
            {TIER_ORDER.map((tier) => {
              const count = data[tier];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={urgencyScoreColor(TIER_SAMPLE_SCORE[tier])}>{TIER_LABELS[tier]}</span>
                    <span className="font-mono text-muted-foreground">
                      {count.toLocaleString("ar-EG")} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={["h-full rounded-full transition-all", urgencyBarColor(TIER_SAMPLE_SCORE[tier])].join(" ")}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && !data && (
        <p className="text-xs text-muted-foreground">تعذّر تحميل التوزيع.</p>
      )}
    </div>
  );
}
