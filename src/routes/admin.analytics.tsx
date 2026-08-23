import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  defaultDateRange,
  distributionProgress,
  fetchAnalyticsData,
  needsBreakdown,
  parseDateRange,
  regionalBreakdown,
  scoreBuckets,
  submissionTrend,
  toDateInputValue,
  topFraudFlags,
  vulnerabilityCounts,
  type TrendPeriod,
} from "@/lib/analytics";
import { adminQueryOptions } from "@/lib/admin-query";

export const Route = createFileRoute("/admin/analytics")({
  component: Analytics,
});

function Bar({ v, max, tone = "bg-foreground" }: { v: number; max: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={["h-full", tone].join(" ")} style={{ width: `${max > 0 ? (v / max) * 100 : 0}%` }} />
    </div>
  );
}

function Analytics() {
  const initial = defaultDateRange();
  const [fromStr, setFromStr] = useState(toDateInputValue(initial.from));
  const [toStr, setToStr] = useState(toDateInputValue(initial.to));
  const [period, setPeriod] = useState<TrendPeriod>("weekly");
  const range = useMemo(() => parseDateRange(fromStr, toStr), [fromStr, toStr]);

  const {
    data: snapshot,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["admin", "analytics", fromStr, toStr],
    queryFn: () => fetchAnalyticsData(range),
    ...adminQueryOptions,
  });

  const loadError = error ? "تعذّر تحميل بيانات التحليلات." : null;

  const rows = snapshot?.requests ?? [];
  const fraud = snapshot?.fraudEvents ?? [];

  const trend = useMemo(() => submissionTrend(rows, range, period), [rows, range, period]);
  const regions = useMemo(() => regionalBreakdown(rows), [rows]);
  const needs = useMemo(() => needsBreakdown(rows), [rows]);
  const vuln = useMemo(() => vulnerabilityCounts(rows), [rows]);
  const trustHist = useMemo(() => scoreBuckets(rows, "trust_score"), [rows]);
  const urgencyHist = useMemo(() => scoreBuckets(rows, "urgency_score"), [rows]);
  const progress = useMemo(() => distributionProgress(rows), [rows]);
  const fraudFlags = useMemo(() => topFraudFlags(fraud), [fraud]);

  const maxTrend = Math.max(1, ...trend.map((d) => d.count));
  const maxRegion = Math.max(1, ...regions.map(([, v]) => v));
  const maxNeed = Math.max(1, ...needs.map(([, v]) => v));
  const maxVuln = Math.max(1, ...vuln.map(([, v]) => v));
  const maxTrust = Math.max(1, ...trustHist.map((d) => d.count));
  const maxUrgency = Math.max(1, ...urgencyHist.map((d) => d.count));
  const maxFraud = Math.max(1, ...fraudFlags.map(([, v]) => v));

  const periodLabels: Record<TrendPeriod, string> = {
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
  };

  const trendTitle =
    period === "daily"
      ? "اتجاه الطلبات — يومي"
      : period === "weekly"
        ? "اتجاه الطلبات — أسبوعي"
        : "اتجاه الطلبات — شهري";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground">من</label>
            <input
              type="date"
              value={fromStr}
              onChange={(e) => setFromStr(e.target.value)}
              className="mt-1 block rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">إلى</label>
            <input
              type="date"
              value={toStr}
              onChange={(e) => setToStr(e.target.value)}
              className="mt-1 block rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {loading ? "جارٍ التحميل..." : `${rows.length} طلب في الفترة المحددة`}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <div className="font-display text-base">{trendTitle}</div>
          <div className="flex gap-1 text-[11px]">
            {(["daily", "weekly", "monthly"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPeriod(t)}
                className={[
                  "rounded-full border px-3 py-1",
                  period === t ? "border-foreground bg-foreground text-background" : "border-border",
                ].join(" ")}
              >
                {periodLabels[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex h-44 items-end gap-2">
          {trend.length === 0 && <div className="text-xs text-muted-foreground">لا توجد بيانات.</div>}
          {trend.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-clay/70"
                style={{ height: `${(d.count / maxTrend) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                title={`${d.label}: ${d.count}`}
              />
              <span className="max-w-full truncate text-[9px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">المناطق الحالية الأكثر طلباً</div>
          <p className="mt-1 text-xs text-muted-foreground">حسب موقع الإقامة الحالي (موقع النزوح)، وليس مكان السكن قبل النزوح.</p>
          <ul className="mt-4 space-y-3 text-sm">
            {regions.length === 0 && <li className="text-xs text-muted-foreground">لا توجد بيانات.</li>}
            {regions.map(([l, v]) => (
              <li key={l} className="flex items-center gap-3">
                <span className="w-32 truncate text-xs text-muted-foreground">{l}</span>
                <div className="flex-1">
                  <Bar v={v} max={maxRegion} />
                </div>
                <span className="w-12 text-left font-mono text-xs">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">الاحتياجات</div>
          <ul className="mt-4 space-y-3 text-sm">
            {needs.length === 0 && <li className="text-xs text-muted-foreground">لا توجد بيانات.</li>}
            {needs.map(([l, v]) => (
              <li key={l} className="flex items-center gap-3">
                <span className="w-32 truncate text-xs text-muted-foreground">{l}</span>
                <div className="flex-1">
                  <Bar v={v} max={maxNeed} tone="bg-clay" />
                </div>
                <span className="w-12 text-left font-mono text-xs">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">الفئات الأكثر ضعفاً</div>
          <ul className="mt-4 space-y-3 text-sm">
            {vuln.length === 0 && (
              <li className="text-xs text-muted-foreground">لا بيانات بعد — ستظهر هنا عند وجود طلبات.</li>
            )}
            {vuln.map(([l, v]) => (
              <li key={l} className="flex items-center gap-3">
                <span className="w-32 truncate text-xs text-muted-foreground">{l}</span>
                <div className="flex-1">
                  <Bar v={v} max={maxVuln} tone="bg-warning" />
                </div>
                <span className="w-12 text-left font-mono text-xs">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">أكثر إشارات الاحتيال</div>
          <ul className="mt-4 space-y-3 text-sm">
            {fraudFlags.length === 0 && <li className="text-xs text-muted-foreground">لا توجد إشارات.</li>}
            {fraudFlags.map(([l, v]) => (
              <li key={l} className="flex items-center gap-3">
                <span dir="ltr" className="w-32 truncate font-mono text-[10px] text-muted-foreground">
                  {l}
                </span>
                <div className="flex-1">
                  <Bar v={v} max={maxFraud} tone="bg-destructive" />
                </div>
                <span className="w-12 text-left font-mono text-xs">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">توزيع نقاط الثقة</div>
          <div className="mt-6 flex h-32 items-end gap-2">
            {trustHist.every((d) => d.count === 0) && (
              <div className="text-xs text-muted-foreground">لا بيانات بعد.</div>
            )}
            {trustHist.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-foreground/70"
                  style={{ height: `${(d.count / maxTrust) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[9px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">توزيع نقاط العجلة</div>
          <div className="mt-6 flex h-32 items-end gap-2">
            {urgencyHist.every((d) => d.count === 0) && (
              <div className="text-xs text-muted-foreground">لا بيانات بعد.</div>
            )}
            {urgencyHist.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-destructive/70"
                  style={{ height: `${(d.count / maxUrgency) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[9px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="font-display text-base">معدّل الإكمال</div>
          <p className="mt-1 text-xs text-muted-foreground">نسبة الطلبات المعتمدة التي تم توزيع المساعدة عليها.</p>
          <div className="mt-6 flex items-end gap-6">
            <div>
              <div className="font-display text-5xl">{progress.rate}%</div>
              <div className="text-xs text-muted-foreground">
                {progress.approved + progress.distributed === 0
                  ? "لا بيانات بعد"
                  : "طلبات معتمدة تم توزيعها"}
              </div>
            </div>
            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-success" style={{ width: `${progress.rate}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>{progress.distributed.toLocaleString("ar-EG")} تم</span>
                <span>{progress.approved.toLocaleString("ar-EG")} متبقّي (معتمدة)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
