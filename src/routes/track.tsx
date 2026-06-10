import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicQrCard } from "@/components/PublicQrCard";
import type { Database } from "@/integrations/supabase/types";
import { lookupTrackRequest, type TrackHistoryEntry, type TrackQueuePosition } from "@/lib/track-request";
import { formatQueueNumber, formatQueuePosition } from "@/lib/queue";
import { phoneToTelHref, type PublicSiteConfig, type RequestStatus } from "@/lib/public-site-config";
import { usePublicSiteConfig } from "@/lib/use-public-site-config";

type DbStatus = Database["public"]["Enums"]["request_status"];

type Status = RequestStatus;
type Submission = {
  code: string;
  name: string;
  phone: string;
  region: string;
  village: string;
  familySize: number;
  shelter: string;
  needs: string[];
  status: Status;
  submittedAt: string;
  history: TrackHistoryEntry[];
  queue: TrackQueuePosition | null;
  requestId: string | null;
};

const STATUS_TONE: Record<Status, string> = {
  submitted: "bg-warning/15 text-warning border-warning/40",
  reviewing: "bg-accent/15 text-accent border-accent/40",
  verifying: "bg-accent/15 text-accent border-accent/40",
  approved: "bg-success/15 text-success border-success/40",
  distributed: "bg-foreground/10 text-foreground border-foreground/25",
  rejected: "bg-destructive/15 text-destructive border-destructive/40",
  on_hold: "bg-warning/15 text-warning border-warning/40",
};

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "تتبّع طلبك — سند" },
      { name: "description", content: "أدخل رقم هاتفك ورقمك المرجعي لمتابعة حالة طلبك." },
    ],
  }),
  component: TrackPage,
});

function currentStageIndex(s: Status, stages: PublicSiteConfig["track"]["timeline_stages"]): number {
  const keys = stages.map((stage) => stage.key);
  const idx = keys.indexOf(s);
  if (idx >= 0) return idx;
  switch (s) {
    case "submitted": return 0;
    case "reviewing": return 1;
    case "verifying": return 2;
    case "approved": return 3;
    case "distributed": return 4;
    default: return 1;
  }
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ar-LB", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Map real aid_request_history rows to timeline stage timestamps. */
function stageTimestamps(sub: Submission, stages: PublicSiteConfig["track"]["timeline_stages"]): (string | null)[] {
  const idx = currentStageIndex(sub.status, stages);
  const byStatus = new Map<DbStatus, string>();

  for (const entry of sub.history) {
    if (!byStatus.has(entry.to_status)) {
      byStatus.set(entry.to_status, entry.changed_at);
    }
  }

  if (!byStatus.has("submitted")) {
    byStatus.set("submitted", sub.submittedAt);
  }

  return stages.map((stage, i) => {
    if (i > idx) return null;
    return byStatus.get(stage.key as DbStatus) ?? null;
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function maskPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return "••• ••• " + digits.slice(-3);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
function TrackPage() {
  const { config } = usePublicSiteConfig();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Submission | "not-found" | "rate-limited" | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    setLoading(true);
    try {
      const trimmedCode = code.trim();
      const trimmedPhone = phone.trim();

      const lookup = await lookupTrackRequest(trimmedCode, trimmedPhone);

      if (!lookup.ok) {
        setResult(lookup.rateLimited ? "rate-limited" : "not-found");
        return;
      }

      const row = lookup.track;

      if (row) {
        const sub: Submission = {
          code: row.reference_code,
          name: row.full_name,
          phone: row.phone_masked,
          region: row.governorate ?? "",
          village: row.distribution_location ?? row.town ?? "",
          familySize: row.family_size,
          shelter: "",
          needs: [],
          status: row.status,
          submittedAt: row.created_at,
          history: lookup.history,
          queue: lookup.queue,
          requestId: row.request_id ?? null,
        };
        setResult(sub);
        setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
      } else {
        setResult("not-found");
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhone(""); setCode(""); setResult(null); setSearched(false);
    setTimeout(() => document.getElementById("track-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  return (
    <main className="min-h-screen bg-background">
      <PublicNav />

      {!config.track.enabled ? (
        <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-6">
          <h1 className="font-display text-3xl">التتبّع غير متاح حالياً</h1>
          <p className="mt-3 text-sm text-muted-foreground">يرجى التواصل مع فريق سند للمساعدة.</p>
        </section>
      ) : (
      <>
      {/* HEADER */}
      <section id="track-form" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 public-nav-offset pb-12 sm:px-6 lg:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-clay sm:text-[11px]">المتابعة</p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">{config.track.page_title}</h1>
          <p className="mt-3 max-w-md text-[13px] text-muted-foreground sm:text-sm">
            {config.track.page_subtitle}
          </p>

          <form onSubmit={onSearch} className="mt-8 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+961 7X XXX XXX"
                className="w-full rounded-lg border border-border bg-background px-4 py-3.5 text-sm focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20"
                required
              />
              <input
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SND-XXXXX"
                className="w-full rounded-lg border border-border bg-background px-4 py-3.5 text-sm font-mono focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20"
                required
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <button disabled={loading} className="touch-target rounded-full bg-primary px-7 py-3 text-sm text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
                {loading ? "جارٍ البحث..." : "تتبّع الطلب"}
              </button>
              <p className="text-[11px] leading-relaxed text-muted-foreground sm:max-w-xs sm:text-xs">
                أدخل الرقم المرجعي ورقم الهاتف الذي استخدمته عند التقديم.
              </p>
            </div>
          </form>
        </div>
      </section>

      {/* RESULT */}
      <section id="result" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        {searched && result === "not-found" && <NotFound config={config} onReset={reset} />}
        {searched && result === "rate-limited" && <RateLimited config={config} onReset={reset} />}
        {result && result !== "not-found" && result !== "rate-limited" && (
          <FoundResult sub={result} config={config} onReset={reset} />
        )}
      </section>
      </>
      )}

      <PublicFooter />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Outcome B — Not Found                                              */
/* ------------------------------------------------------------------ */
function NotFound({ config, onReset }: { config: PublicSiteConfig; onReset: () => void }) {
  return (
    <div className="rise rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="mt-4 font-display text-2xl text-foreground sm:text-3xl">{config.track.not_found_title}</h2>
      <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
        {config.track.not_found_bullets.map((line) => (
          <li key={line} className="flex gap-2"><span className="text-clay">•</span> {line}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={onReset} className="touch-target rounded-full border border-border px-5 py-2.5 text-sm hover:border-foreground/40">
          إعادة المحاولة
        </button>
        <a href={phoneToTelHref(config.track.contact_phone)} className="touch-target rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-primary/90">
          الاتصال بالفريق
        </a>
      </div>
    </div>
  );
}

function RateLimited({ config, onReset }: { config: PublicSiteConfig; onReset: () => void }) {
  return (
    <div className="rise rounded-2xl border border-warning/30 bg-warning/5 p-6 sm:p-8">
      <h2 className="font-display text-2xl text-foreground sm:text-3xl">تجاوزت الحد المسموح</h2>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
        {config.track.rate_limit_message}
      </p>
      <div className="mt-6">
        <button onClick={onReset} className="rounded-full border border-border bg-background px-5 py-2.5 text-sm hover:border-foreground/40">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outcome A — Found                                                  */
/* ------------------------------------------------------------------ */
function FoundResult({
  sub,
  config,
  onReset,
}: {
  sub: Submission;
  config: PublicSiteConfig;
  onReset: () => void;
}) {
  const stages = config.track.timeline_stages;
  const idx = currentStageIndex(sub.status, stages);
  const ts = stageTimestamps(sub, stages);
  const [openSummary, setOpenSummary] = useState(false);
  const isDistributed = sub.status === "distributed";
  const showQr =
    config.qr.show_on_track_when_approved &&
    sub.requestId &&
    (sub.status === "approved" || sub.status === "distributed");

  return (
    <div className="rise space-y-6">
      {/* IDENTITY */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-surface/60 px-5 py-3 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">الرقم المرجعي</div>
            <span className={["rounded-full border px-2.5 py-0.5 text-[10px] sm:text-[11px]", STATUS_TONE[sub.status]].join(" ")}>
              {config.track.status_labels[sub.status]}
            </span>
          </div>
          <div dir="ltr" className="mt-1 font-display text-3xl text-foreground sm:text-4xl">{sub.code}</div>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">صاحب الطلب</div>
            <div className="mt-1 font-display text-lg text-foreground sm:text-xl">{sub.name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">تاريخ التقديم</div>
            <div className="mt-1 text-[13px] text-foreground sm:text-sm">{fmtDate(sub.submittedAt)}</div>
          </div>
        </div>
      </div>

      {config.track.show_queue_position && sub.queue && (
        <div className="rounded-2xl border border-clay/30 bg-clay/5 p-5 sm:p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-clay">دورك في القائمة</div>
          <div className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
            {formatQueuePosition(sub.queue.position_among_pending, sub.queue.pending_total)}
          </div>
          <div className="mt-1.5 text-[12px] text-muted-foreground sm:text-[13px]">
            رقم الدور: {formatQueueNumber(sub.queue.queue_number)}
          </div>
        </div>
      )}

      {/* TIMELINE */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-clay">المسار</div>
        <h3 className="mt-1.5 font-display text-xl text-foreground sm:text-2xl">مراحل طلبك</h3>

        <ol className="mt-6 space-y-0">
          {stages.map((stage, i) => {
            const done = i < idx;
            const active = i === idx && sub.status !== "distributed";
            const completed = i <= idx && (i < idx || sub.status === "distributed");
            const upcoming = i > idx;
            const lineColor = i < idx ? "bg-success" : i === idx ? "bg-clay" : "bg-border";
            return (
              <li key={stage.key} className="relative flex gap-4 pb-6 last:pb-0">
                {/* connector line */}
                {i < stages.length - 1 && (
                  <span className={["absolute right-[14px] top-8 -z-0 h-[calc(100%-1.5rem)] w-0.5", lineColor].join(" ")} />
                )}
                {/* node */}
                <span
                  className={[
                    "relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-mono transition",
                    completed ? "border-success bg-success text-white" :
                    active ? "border-clay bg-clay text-white" :
                    "border-border bg-background text-muted-foreground",
                  ].join(" ")}
                >
                  {completed ? "✓" : active ? "●" : i + 1}
                </span>

                <div className={["min-w-0 flex-1", upcoming ? "opacity-50" : ""].join(" ")}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <div className={["text-[14px] sm:text-base", active || completed ? "font-medium text-foreground" : "text-foreground"].join(" ")}>
                      {stage.title}
                    </div>
                    {active && (
                      <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] text-clay">
                        المرحلة الحالية
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground sm:text-[13px]">
                    {stage.desc}
                  </div>
                  {ts[i] && (
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground sm:text-xs">
                      {fmtDate(ts[i]!)}
                      {i === 4 && isDistributed && ` · ${sub.village}`}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* WHAT HAPPENS NEXT */}
      <div className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay/15 text-clay">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display text-base text-foreground sm:text-lg">ماذا يحدث الآن</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground sm:text-sm">
              {config.track.next_steps[sub.status]}
            </p>
          </div>
        </div>
      </div>

      {showQr && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-clay">رمز الاستلام</div>
          <h3 className="mt-1.5 font-display text-xl text-foreground sm:text-2xl">اعرض هذا الرمز عند التوزيع</h3>
          <PublicQrCard
            referenceCode={sub.code}
            requestId={sub.requestId!}
            instructions={config.qr.track_qr_instructions}
            compact
          />
        </div>
      )}

      {/* SUBMITTED SUMMARY (collapsible) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <button
          onClick={() => setOpenSummary((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right sm:px-6"
        >
          <div>
            <div className="font-display text-base text-foreground sm:text-lg">معلومات طلبك</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">عرض ملخّص البيانات التي قدّمتها</div>
          </div>
          <span className={["font-mono text-clay transition-transform duration-300", openSummary ? "rotate-45" : ""].join(" ")}>+</span>
        </button>
        <div
          className={[
            "grid transition-all duration-300 ease-out",
            openSummary ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          ].join(" ")}
        >
          <div className="overflow-hidden">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border px-5 py-5 sm:grid-cols-2 sm:px-6">
              <Row label="الاسم" value={sub.name} />
              <Row label="رقم الهاتف" value={maskPhone(sub.phone)} ltr />
              <Row label="قضاء" value={sub.region} />
              <Row label="مكان الاقامة قبل النزوح" value={sub.village} />
              <Row label="عدد أفراد العائلة" value={String(sub.familySize)} />
              <Row label="نوع المأوى" value={sub.shelter} />
              <div className="sm:col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">الحاجات المختارة</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sub.needs.map((n) => (
                    <span key={n} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[12px] text-foreground sm:text-xs">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <Row label="نوع المرجع" value="مختار / شيخ بلد" />
              <Row label="منطقة المرجع" value={sub.region} />
            </dl>
          </div>
        </div>
      </div>

      {/* NOTES */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 sm:p-6">
        <div className="font-display text-base text-foreground sm:text-lg">تذكيرات مهمّة</div>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground sm:text-sm">
          {config.track.reminders.map((line) => (
            <li key={line} className="flex gap-2"><span className="text-clay">◆</span> {line}</li>
          ))}
        </ul>
      </div>

      {/* CONTACT */}
      <div className="rounded-2xl border border-border bg-ink p-5 text-white sm:p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-clay">للتواصل</div>
        <div className="mt-2 font-display text-lg sm:text-xl">{config.track.contact_heading}</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <a href={phoneToTelHref(config.track.contact_phone)} className="group flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 transition hover:bg-white/10">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/60">{config.track.contact_subheading}</div>
              <div dir="ltr" className="mt-1 font-mono text-base text-white">{config.track.contact_phone}</div>
            </div>
            <span className="text-white/70 transition group-hover:-translate-x-1">←</span>
          </a>
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-white/60">ساعات العمل</div>
            <div className="mt-1 text-[13px] text-white sm:text-sm">{config.track.contact_hours}</div>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button onClick={onReset} className="rounded-full border border-border bg-background px-5 py-3 text-[13px] hover:border-foreground/40 sm:text-sm">
          تتبّع طلب آخر
        </button>
        <Link to="/" className="rounded-full bg-primary px-6 py-3 text-[13px] text-primary-foreground hover:bg-primary/90 sm:text-sm">
          تقديم طلب جديد
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div dir={ltr ? "ltr" : undefined} className={["mt-1 text-[13px] text-foreground sm:text-sm", ltr ? "text-right font-mono" : ""].join(" ")}>
        {value}
      </div>
    </div>
  );
}
