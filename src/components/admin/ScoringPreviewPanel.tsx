import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchScoringPreviewSamples,
  type ScoringPreviewSample,
} from "@/lib/scoring-config";
import {
  CATEGORY_LABELS,
  TIER_LABELS,
  urgencyScoreColor,
  type CategoryKey,
  type UrgencyTier,
} from "@/lib/scoring";

export function ScoringPreviewPanel() {
  const [samples, setSamples] = useState<ScoringPreviewSample[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      setSamples(await fetchScoringPreviewSamples(20));
    } catch {
      setSamples([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">معاينة — آخر 20 طلباً</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            العجلة الحالية قبل/بعد الحفظ — أعد الاحتساب الجماعي لتطبيق الإعدادات الجديدة.
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

      {!loading && samples.length === 0 && (
        <p className="text-xs text-muted-foreground">لا توجد طلبات للمعاينة.</p>
      )}

      {!loading &&
        samples.map((s) => {
          const urg = s.effective_urgency ?? s.urgency_score;
          const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
          const breakdown = s.urgency_breakdown;
          return (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    to="/admin/requests/$id"
                    params={{ id: s.id }}
                    className="font-medium text-clay hover:underline"
                  >
                    {s.full_name}
                  </Link>
                  <div dir="ltr" className="font-mono text-[10px] text-muted-foreground">
                    {s.reference_code}
                  </div>
                </div>
                <div className="text-left">
                  <span className={["font-mono text-sm", urgencyScoreColor(urg)].join(" ")}>
                    {urg}
                  </span>
                  {s.urgency_tier && (
                    <span className="ms-2 text-[10px] text-muted-foreground">
                      {TIER_LABELS[tierKey]}
                    </span>
                  )}
                  {breakdown?.config_version != null && (
                    <div className="text-[10px] text-muted-foreground">
                      إصدار القواعد: {breakdown.config_version}
                    </div>
                  )}
                </div>
              </div>
              {breakdown?.categories && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(Object.keys(breakdown.categories) as CategoryKey[]).map((key) => {
                    const cat = breakdown.categories[key];
                    if (!cat || cat.points === 0) return null;
                    return (
                      <span
                        key={key}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px]"
                      >
                        {CATEGORY_LABELS[key]}: {cat.points}/{cat.max}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
