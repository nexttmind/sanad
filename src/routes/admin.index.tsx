import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  TIER_BADGE_CLASS,
  TIER_LABELS,
  urgencyScoreColor,
  type UrgencyTier,
} from "@/lib/scoring";
import { formatQueueNumber } from "@/lib/queue";

type Row = Database["public"]["Tables"]["aid_requests"]["Row"];

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

function Overview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("aid_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (alive) {
        setRows(data ?? []);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel("admin-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "aid_requests" }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = rows.filter((r) => new Date(r.created_at) >= today).length;
  const byStatus = (s: string) => rows.filter((r) => r.status === s).length;

  const cards = [
    { label: "إجمالي الطلبات", value: rows.length },
    { label: "اليوم", value: todayCount },
    { label: "قيد الانتظار", value: byStatus("submitted") },
    { label: "قيد المراجعة", value: byStatus("reviewing") },
    { label: "موافق عليها", value: byStatus("approved") },
    { label: "تم التوزيع", value: byStatus("distributed") },
    { label: "معلّقة", value: byStatus("on_hold") },
    { label: "مرفوضة", value: byStatus("rejected") },
  ];

  const flagged = rows.filter((r) => r.flags.length > 0).length;
  const infantsPending = rows.filter((r) => r.infants > 0 && r.status === "submitted").length;
  const disabledPending = rows.filter((r) => r.disabled && r.status === "submitted").length;
  const shelterPending = rows.filter(
    (r) =>
      r.status === "submitted" &&
      r.housing_type &&
      (r.housing_type.toLowerCase().includes("school") ||
        r.housing_type.includes("مدرسة") ||
        r.housing_type.includes("مأوى")),
  ).length;
  const critical = rows.filter(
    (r) => (r.effective_urgency ?? r.urgency_score) >= 85 && r.status === "submitted",
  ).length;
  const pendingQueue = rows.filter((r) =>
    ["submitted", "reviewing", "verifying", "on_hold"].includes(r.status),
  );
  const oldestQueue = pendingQueue.reduce<number | null>((min, r) => {
    const qn = r.queue_number;
    if (qn == null) return min;
    return min == null || qn < min ? qn : min;
  }, null);
  const highRisk = rows.filter((r) => r.risk_level === "fraud" || r.risk_level === "critical").length;

  const topPending = [...pendingQueue]
    .sort(
      (a, b) =>
        (b.effective_urgency ?? b.urgency_score) - (a.effective_urgency ?? a.urgency_score) ||
        a.queue_number - b.queue_number,
    )
    .slice(0, 5);

  const recentRows = [...rows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const alerts = [
    { label: "حالات حرجة معلّقة", count: critical, tone: "bg-destructive/15 text-destructive border-destructive/30" },
    {
      label: "قيد الدور",
      count: pendingQueue.length,
      tone: "bg-clay/15 text-clay border-clay/40",
      href: "/admin/queue" as const,
    },
    ...(oldestQueue != null
      ? [
          {
            label: "أقدم رقم دور",
            count: oldestQueue,
            tone: "bg-foreground/10 text-foreground border-foreground/25",
            format: "queue" as const,
          },
        ]
      : []),
    { label: "رضّع لم تتم مراجعتهم", count: infantsPending, tone: "bg-warning/15 text-warning border-warning/40" },
    { label: "ذوو احتياجات معلّقون", count: disabledPending, tone: "bg-warning/15 text-warning border-warning/40" },
    { label: "مدارس/مأوى معلّقة", count: shelterPending, tone: "bg-clay/15 text-clay border-clay/40" },
    { label: "احتيال مرتفع", count: highRisk, tone: "bg-destructive/15 text-destructive border-destructive/30" },
    { label: "موسومة", count: flagged, tone: "bg-warning/15 text-warning border-warning/40" },
  ];

  // Needs breakdown
  const needsMap = new Map<string, number>();
  rows.forEach((r) => r.needs.forEach((n) => needsMap.set(n, (needsMap.get(n) ?? 0) + 1)));
  const needsBreakdown = Array.from(needsMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxNeed = Math.max(1, ...needsBreakdown.map(([, v]) => v));

  // Daily (last 7 days)
  const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    return rows.filter((r) => {
      const t = new Date(r.created_at);
      return t >= d && t < next;
    }).length;
  });
  const max = Math.max(1, ...daily);

  // Vulnerable
  const vuln: [string, number][] = [
    ["رضّع", rows.reduce((a, r) => a + r.infants, 0)],
    ["ذوو إعاقة", rows.filter((r) => r.disabled).length],
    ["مرض مزمن", rows.filter((r) => r.chronic_illness).length],
    ["كبار سن", rows.reduce((a, r) => a + r.elderly, 0)],
  ];
  const vulnMax = Math.max(1, ...vuln.map(([, v]) => v));

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] text-muted-foreground">{c.label}</div>
            <div className="mt-2 font-display text-2xl">{c.value.toLocaleString("ar-EG")}</div>
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
            ) : (
              <span key={a.label} className={["rounded-full border px-4 py-2 text-xs", a.tone].join(" ")}>
                {inner}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {topPending.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="font-display text-base">أولوية الدور الآن</div>
                <Link to="/admin/queue" className="text-[11px] text-clay hover:underline">
                  عرض الدور الكامل
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {topPending.map((s) => {
                  const urg = s.effective_urgency ?? s.urgency_score;
                  const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
                  return (
                    <li key={s.id}>
                      <Link
                        to="/admin/requests/$id"
                        params={{ id: s.id }}
                        className="flex items-center gap-4 px-5 py-3 text-sm transition hover:bg-surface"
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatQueueNumber(s.queue_number)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{s.full_name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{s.governorate ?? "—"}</div>
                        </div>
                        <span className={["font-mono text-xs", urgencyScoreColor(urg)].join(" ")}>{urg}</span>
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
                      </Link>
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
                  <li key={s.id}>
                    <Link
                      to="/admin/requests/$id"
                      params={{ id: s.id }}
                      className="grid grid-cols-12 gap-3 px-5 py-3 text-sm transition hover:bg-surface"
                    >
                      <div className="col-span-1 font-mono text-[10px] text-muted-foreground">
                        {formatQueueNumber(s.queue_number)}
                      </div>
                      <div className="col-span-3 truncate">
                        <div className="truncate font-medium">{s.full_name}</div>
                        <div dir="ltr" className="truncate font-mono text-[10px] text-muted-foreground">
                          {s.reference_code}
                        </div>
                      </div>
                      <div className="col-span-3 truncate text-muted-foreground">{s.governorate ?? "—"}</div>
                      <div className="col-span-2">
                        <span className="font-mono text-xs">ثقة {s.trust_score}</span>
                      </div>
                      <div className="col-span-2">
                        <span className={["font-mono text-xs", urgencyScoreColor(urg)].join(" ")}>
                          عجلة {urg}
                        </span>
                      </div>
                      <div className="col-span-1 text-left text-[10px] text-muted-foreground">
                        {timeAgo(s.queued_at ?? s.created_at)}
                      </div>
                    </Link>
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
