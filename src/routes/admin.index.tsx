import { createFileRoute, Link } from "@tanstack/react-router";
import {
  type AdminOverviewPendingRow,
  type AdminOverviewRecentRow,
} from "@/lib/admin-overview";
import { adminQueryKeys, useAdminOverviewStats } from "@/lib/admin-query";
import { useAdminQueryRealtime } from "@/lib/use-admin-query-realtime";
import {
  TIER_BADGE_CLASS,
  TIER_LABELS,
  urgencyScoreColor,
  type UrgencyTier,
} from "@/lib/scoring";
import { formatQueueNumber } from "@/lib/queue";
import type { Database } from "@/integrations/supabase/types";

type DbStatus = Database["public"]["Enums"]["request_status"];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `قبل ${Math.floor(diff)} ث`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return `قبل ${Math.floor(diff / 86400)} ي`;
}

export const Route = createFileRoute("/admin/")({
  component: Overview,
});

const STATUS_LABELS: { key: DbStatus; label: string }[] = [
  { key: "submitted", label: "قيد الانتظار" },
  { key: "reviewing", label: "قيد المراجعة" },
  { key: "approved", label: "موافق عليها" },
  { key: "distributed", label: "تم التوزيع" },
  { key: "on_hold", label: "معلّقة" },
  { key: "rejected", label: "مرفوضة" },
];

function Overview() {
  const { data: stats, isLoading: loading } = useAdminOverviewStats();

  useAdminQueryRealtime("admin-overview", "aid_requests", [adminQueryKeys.overview()]);

  const statusCount = (s: DbStatus) => stats?.status_counts[s] ?? 0;

  const cards = stats
    ? [
        { label: "إجمالي الطلبات", value: stats.total },
        { label: "اليوم", value: stats.today_count },
        ...STATUS_LABELS.map(({ key, label }) => ({ label, value: statusCount(key) })),
      ]
    : [];

  const alerts = stats
    ? [
        {
          label: "حالات حرجة معلّقة",
          count: stats.alerts.critical,
          tone: "bg-destructive/15 text-destructive border-destructive/30",
          requestsSearch: { status: "submitted", urgency_min: "85", sort: "effective_urgency", dir: "desc" },
        },
        {
          label: "قيد الدور",
          count: stats.alerts.pending_queue,
          tone: "bg-clay/15 text-clay border-clay/40",
          href: "/admin/queue" as const,
        },
        ...(stats.alerts.oldest_queue != null
          ? [
              {
                label: "أقدم رقم دور",
                count: stats.alerts.oldest_queue,
                tone: "bg-foreground/10 text-foreground border-foreground/25",
                format: "queue" as const,
              },
            ]
          : []),
        {
          label: "رضّع لم تتم مراجعتهم",
          count: stats.alerts.infants_pending,
          tone: "bg-warning/15 text-warning border-warning/40",
          requestsSearch: { status: "submitted", sort: "created_at", dir: "asc" },
        },
        {
          label: "ذوو احتياجات معلّقون",
          count: stats.alerts.disabled_pending,
          tone: "bg-warning/15 text-warning border-warning/40",
          requestsSearch: { status: "submitted", sort: "effective_urgency", dir: "desc" },
        },
        {
          label: "مدارس/مأوى معلّقة",
          count: stats.alerts.shelter_pending,
          tone: "bg-clay/15 text-clay border-clay/40",
          requestsSearch: { status: "submitted", sort: "effective_urgency", dir: "desc" },
        },
        {
          label: "احتيال مرتفع",
          count: stats.alerts.high_risk,
          tone: "bg-destructive/15 text-destructive border-destructive/30",
          requestsSearch: { risk: "fraud", sort: "trust_score", dir: "asc" },
        },
        {
          label: "موسومة",
          count: stats.alerts.flagged,
          tone: "bg-warning/15 text-warning border-warning/40",
          requestsSearch: { flags: "1", sort: "created_at", dir: "desc" },
        },
      ]
    : [];

  const needsBreakdown = stats?.needs_breakdown ?? [];
  const maxNeed = Math.max(1, ...needsBreakdown.map(([, v]) => v));
  const daily = stats?.daily_last_7 ?? [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...daily);
  const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

  const vuln: [string, number][] = stats
    ? [
        ["رضّع", stats.vulnerable.infants],
        ["ذوو إعاقة", stats.vulnerable.disabled],
        ["مرض مزمن", stats.vulnerable.chronic],
        ["كبار سن", stats.vulnerable.elderly],
      ]
    : [];
  const vulnMax = Math.max(1, ...vuln.map(([, v]) => v));

  const topPending: AdminOverviewPendingRow[] = stats?.top_pending ?? [];
  const recentRows: AdminOverviewRecentRow[] = stats?.recent ?? [];

  const pipeline = STATUS_LABELS.map(({ key, label }) => ({
    key,
    label,
    count: statusCount(key),
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count));

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <div className="text-[10px] text-muted-foreground sm:text-[11px]">{c.label}</div>
            <div className="mt-1.5 font-display text-xl sm:mt-2 sm:text-2xl">{c.value.toLocaleString("ar-EG")}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">تنبيهات الأولوية</div>
        <div className="flex flex-wrap gap-2">
          {alerts.map((a) => {
            const countLabel =
              "format" in a && a.format === "queue"
                ? formatQueueNumber(a.count)
                : a.count.toLocaleString("ar-EG");
            const inner = (
              <>
                {a.label} <span className="mr-2 font-mono">{countLabel}</span>
              </>
            );
            return "href" in a && a.href ? (
              <Link
                key={a.label}
                to={a.href}
                className={["rounded-full border px-4 py-2 text-xs transition hover:opacity-80", a.tone].join(" ")}
              >
                {inner}
              </Link>
            ) : "requestsSearch" in a && a.requestsSearch ? (
              <Link
                key={a.label}
                to="/admin/requests"
                search={a.requestsSearch}
                className={["rounded-full border px-4 py-2 text-xs transition hover:opacity-80", a.tone].join(" ")}
              >
                {inner}
              </Link>
            ) : (
              <span key={a.label} className={["rounded-full border px-4 py-2 text-xs", a.tone].join(" ")}>
                {inner}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="font-display text-base">مسار معالجة الطلبات</div>
        <p className="mt-1 text-xs text-muted-foreground">توزيع الطلبات حسب الحالة الحالية</p>
        <div className="mt-4 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
          {!loading &&
            pipeline.map(({ key, label, count }) => (
              <div key={key}>
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-mono">{count.toLocaleString("ar-EG")}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-clay/80"
                    style={{ width: `${(count / pipelineMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {topPending.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="font-display text-base">أولوية الدور الآن</div>
                <Link to="/admin/queue" className="rounded-md border border-clay/30 bg-clay/5 px-3 py-1.5 text-[11px] text-clay transition hover:bg-clay/10 active:bg-clay/20">
                  عرض الدور الكامل
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {topPending.map((s) => {
                  const urg = s.effective_urgency ?? s.urgency_score;
                  const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
                  return (
                    <li key={s.id} className="transition hover:bg-surface">
                      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {formatQueueNumber(s.queue_number)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-sm">{s.full_name}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{s.governorate ?? "—"}</div>
                          </div>
                          <span className={["shrink-0 font-mono text-xs sm:hidden", urgencyScoreColor(urg)].join(" ")}>{urg}</span>
                        </div>
                        <div className="flex flex-col gap-3 sm:items-end sm:justify-center">
                          <div className="hidden items-center gap-2 text-xs sm:flex">
                            <span className={["font-mono", urgencyScoreColor(urg)].join(" ")}>{urg}</span>
                            {s.urgency_tier && (
                              <span
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[10px]",
                                  TIER_BADGE_CLASS[tierKey],
                                ].join(" ")}
                              >
                                {TIER_LABELS[tierKey]}
                              </span>
                            )}
                          </div>
                          <Link
                            to="/admin/requests/$id"
                            params={{ id: s.id }}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-clay/10 px-4 py-2 text-xs font-medium text-clay transition-colors hover:bg-clay/20 active:bg-clay/30 sm:w-auto sm:rounded-md sm:px-3 sm:py-1.5"
                          >
                            <span className="sm:hidden">عرض التفاصيل ←</span>
                            <span className="hidden sm:inline">عرض</span>
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base">الطلبات الأخيرة</div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-clay live-dot" /> مباشر
              </div>
            </div>
            <ul className="divide-y divide-border">
              {loading && <li className="px-5 py-6 text-sm text-muted-foreground">جارٍ التحميل...</li>}
              {!loading && recentRows.length === 0 && (
                <li className="px-5 py-6 text-sm text-muted-foreground">لا توجد طلبات بعد.</li>
              )}
              {recentRows.map((s) => {
                const urg = s.effective_urgency ?? s.urgency_score;
                return (
                  <li key={s.id} className="transition hover:bg-surface">
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground mt-0.5">
                          {formatQueueNumber(s.queue_number)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-sm">{s.full_name}</div>
                          <div dir="ltr" className="truncate font-mono text-[10px] text-muted-foreground">
                            {s.reference_code}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:items-end">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="text-muted-foreground">{s.governorate ?? "—"}</span>
                          <span className="font-mono">ثقة {s.trust_score}</span>
                          <span className={["font-mono", urgencyScoreColor(urg)].join(" ")}>
                            عجلة {urg}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(s.queued_at ?? s.created_at)}
                          </span>
                        </div>
                        <Link
                          to="/admin/requests/$id"
                          params={{ id: s.id }}
                          className="inline-flex w-full items-center justify-center rounded-lg bg-clay/10 px-4 py-2 text-xs font-medium text-clay transition-colors hover:bg-clay/20 active:bg-clay/30 sm:w-auto sm:rounded-md sm:px-3 sm:py-1.5"
                        >
                          <span className="sm:hidden">عرض التفاصيل ←</span>
                          <span className="hidden sm:inline">عرض</span>
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">ملخّص الفئات الضعيفة</div>
          <div className="mt-4 space-y-3 text-sm">
            {vuln.map(([l, v]) => (
              <div key={l}>
                <div className="flex justify-between text-xs">
                  <span>{l}</span>
                  <span className="font-mono">{v}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-clay" style={{ width: `${(v / vulnMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">الطلبات اليومية — آخر ٧ أيام</div>
          <div className="mt-6 flex h-40 items-end gap-3">
            {daily.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t bg-clay/70" style={{ height: `${(d / max) * 100}%` }} />
                <div className="text-[10px] text-muted-foreground">{days[i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display text-base">توزيع الاحتياجات</div>
          <div className="mt-4 space-y-2 text-sm">
            {needsBreakdown.length === 0 && (
              <div className="text-xs text-muted-foreground">لا توجد بيانات بعد.</div>
            )}
            {needsBreakdown.map(([l, v]) => (
              <div key={l} className="flex items-center gap-3">
                <span className="w-24 truncate text-xs text-muted-foreground">{l}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${(v / maxNeed) * 100}%` }} />
                </div>
                <span className="w-10 text-left font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
