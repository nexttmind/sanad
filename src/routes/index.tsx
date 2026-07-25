import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicQrCard } from "@/components/PublicQrCard";
import { DynamicAidForm } from "@/components/aid-form/DynamicAidForm";
import { usePublicSiteConfig } from "@/lib/use-public-site-config";
import { useAidFormSchema } from "@/lib/use-aid-form-schema";
import { aidRequestHeroPhoto, sanadLogoPhoto } from "@/lib/donate-photos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سند — قدّم طلب مساعدة" },
      {
        name: "description",
        content: "نموذج تقديم طلب مساعدة للعائلات النازحة في الجنوب اللبناني. بيانات سرّية ومحميّة.",
      },
    ],
  }),
  component: RequestHome,
});

function Success({ code, id, onReset }: { code: string; id: string; onReset: () => void }) {
  const { config } = usePublicSiteConfig();
  const [copied, setCopied] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-6 sm:py-24 lg:px-10">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success rise">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-3xl sm:text-4xl">{config.qr.submit_success_title}</h1>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">{config.qr.submit_success_subtitle}</p>

      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">رقمك المرجعي</div>
        <div className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div dir="ltr" className="font-mono text-xl text-foreground sm:text-3xl">
            {code}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="touch-target rounded-full border border-border px-4 py-2.5 text-sm hover:border-clay"
          >
            {copied ? "تم النسخ ✓" : "نسخ"}
          </button>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          قيد المراجعة
        </div>

        {config.qr.show_on_submit_success && (
          <PublicQrCard
            referenceCode={code}
            requestId={id}
            instructions={config.qr.submit_success_instructions}
          />
        )}
      </div>

      <div className="mx-auto mt-8 max-w-xl space-y-3 text-right">
        <p className="font-display text-base sm:text-lg">ماذا يحدث الآن</p>
        <ol className="space-y-2 text-[13px] text-muted-foreground sm:text-sm">
          {config.qr.submit_success_steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="font-mono text-clay">{["٠١", "٠٢", "٠٣", "٠٤", "٠٥"][i] ?? String(i + 1)}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={onReset}
          className="rounded-full border border-border px-5 py-3 text-sm hover:border-foreground/40"
        >
          تقديم طلب جديد
        </button>
        <Link to="/donate" className="rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground hover:bg-primary/90">
          صفحة التبرّع
        </Link>
        <Link to="/track" className="rounded-full border border-border px-5 py-3 text-sm hover:border-clay">
          تتبّع طلبك
        </Link>
      </div>
    </div>
  );
}

function RequestHome() {
  const [submitted, setSubmitted] = useState<{ code: string; id: string } | null>(null);
  const startedAt = useRef<number>(Date.now());
  const { schema, loading } = useAidFormSchema();

  if (submitted) {
    return (
      <main className="min-h-screen bg-background">
        <PublicNav />
        <div className="pt-24">
          <Success code={submitted.code} id={submitted.id} onReset={() => window.location.reload()} />
        </div>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <PublicNav tone="dark" greenMobileMenu />

      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0">
          <img
            src={aidRequestHeroPhoto}
            alt=""
            className="kb-hero-fit h-full w-full origin-center object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/70 to-background" />
          <div className="absolute inset-0 grain" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 public-nav-offset pb-14 sm:px-6 sm:pb-20 lg:px-10">
          <div className="fade-soft flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute inset-0 -m-3 rounded-full bg-primary/25 blur-2xl" />
              <div className="relative flex h-[5.25rem] w-[5.25rem] items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/95 p-1.5 shadow-lg sm:h-24 sm:w-24 sm:p-2">
                <img src={sanadLogoPhoto} alt="شعار حملة سند" className="h-full w-full scale-[1.18] object-contain" />
              </div>
            </div>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.32em] text-white/70 sm:text-[11px] sm:tracking-[0.55em]">
              S · A · N · A · D — سَنَد
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.32em] text-white/80 sm:text-[11px]">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-clay" />
              تقديم طلب مساعدة — مفتوح الآن
            </div>

            <h1 className="rise mt-5 max-w-3xl font-display text-3xl leading-[1.15] sm:text-5xl md:text-6xl">
              صوتك يَصِل. <span className="text-clay">طلبك يُسمَع.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-white/80 sm:text-base">
              املأ هذا الطلب بصدق وبهدوء. كل حقل تتجاوزه بأمانة يُقرّبك خطوةً من المساعدة. بياناتك محميّة، ولا
              تُشارَك مع أي طرفٍ ثالث.
            </p>

            <div className="mt-7 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <a
                href="#sec-personal"
                className="touch-target rounded-full bg-white px-6 py-3 text-center text-[13px] font-medium text-ink transition hover:bg-clay hover:text-white sm:text-sm"
              >
                ابدأ تعبئة الطلب ↓
              </a>
              <Link
                to="/track"
                className="touch-target rounded-full border border-white/30 px-5 py-3 text-center text-[13px] text-white/90 transition hover:bg-white/10 sm:text-sm"
              >
                تتبّع طلبٍ سابق
              </Link>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DynamicAidForm schema={schema} startedAt={startedAt.current} onSuccess={setSubmitted} />
      )}

      <PublicFooter />
    </main>
  );
}
