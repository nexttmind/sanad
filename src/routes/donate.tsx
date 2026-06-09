import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DonationSubmitForm, type DonationIntent } from "@/components/DonationSubmitForm";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import {
  fetchRecentDonationMessages,
  formatBeneficiaryLabel,
  formatLedgerDate,
  ledgerItemLabel,
  usePublicLedger,
  type LedgerRow,
  type PledgeMessage,
} from "@/lib/donations";
import {
  ALT_DONATION_DISPLAY,
  ALT_DONATION_PHONE,
  WHISH_DONATION_DISPLAY,
  WHISH_DONATION_PHONE,
  telHref,
  whatsappHref,
} from "@/lib/donation-contacts";
import { sanadLogoPhoto } from "@/lib/donate-photos";
import hero1 from "@/assets/hero-1.jpg";
import hero3 from "@/assets/hero-3.jpg";
import hero4 from "@/assets/hero-4.jpg";
import { DonationJourney } from "@/components/DonationJourney";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "تبرّع — سند" },
      { name: "description", content: "تبرّعك ليس رقماً. إنه وجبة، حفاضة، دواء. تبرّع عبر Whish أو تواصل معنا للقنوات الأخرى." },
      { property: "og:title", content: "تبرّع — سند" },
      { property: "og:image", content: hero1 },
    ],
  }),
  component: DonatePage,
});

/* ----------------------------- atoms ----------------------------- */
function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-clay sm:text-[11px]">{children}</p>;
}

function CopyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [c, setC] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {href ? (
          <a
            href={href}
            dir="ltr"
            className="mt-0.5 block truncate font-mono text-[13px] text-clay hover:underline"
          >
            {value}
          </a>
        ) : (
          <div dir="ltr" className="mt-0.5 truncate font-mono text-[13px] text-foreground">{value}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1200); }}
        className="touch-target shrink-0 rounded-full border border-border bg-background px-4 py-2 text-xs hover:border-clay hover:text-clay"
      >
        {c ? "نُسخ ✓" : "نسخ"}
      </button>
    </div>
  );
}

function OneClickContact({
  label,
  phone,
  display,
}: {
  label: string;
  phone: string;
  display: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <a href={telHref(phone)} dir="ltr" className="mt-1 block font-mono text-lg text-clay hover:underline">
        {display}
      </a>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href={telHref(phone)}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-foreground px-4 py-3 text-[13px] font-medium text-background transition hover:bg-clay"
        >
          اتصال مباشر
        </a>
        <a
          href={whatsappHref(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-4 py-3 text-[13px] font-medium transition hover:border-clay hover:text-clay"
        >
          واتساب
        </a>
      </div>
    </div>
  );
}

/* ----------------------------- HERO (Ken-Burns cycling) ----------------------------- */
const heroFrames = [
  { src: hero1, kb: "kb-1" },
  { src: hero3, kb: "kb-3" },
  { src: hero4, kb: "kb-4" },
];

function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % heroFrames.length), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="relative isolate min-h-[72vh] overflow-hidden bg-ink text-white sm:min-h-[88vh]">
      {/* cycling frames */}
      <div className="absolute inset-0">
        {heroFrames.map((f, idx) => (
          <img
            key={idx}
            src={f.src}
            alt=""
            className={[
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-[2000ms] ease-in-out",
              idx === i ? `${f.kb} opacity-55` : "opacity-0",
            ].join(" ")}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/60 to-ink" />
        <div className="absolute inset-0 grain" />
      </div>

      {/* content */}
      <div className="relative mx-auto flex min-h-[72vh] max-w-6xl flex-col px-4 pb-10 public-nav-offset sm:min-h-[88vh] sm:px-6 sm:pb-12 lg:px-10">
        <div className="fade-soft flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 -m-3 rounded-full bg-primary/25 blur-2xl" />
            <div className="relative flex h-[5.25rem] w-[5.25rem] items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/95 p-1.5 shadow-lg sm:h-24 sm:w-24 sm:p-2">
              <img src={sanadLogoPhoto} alt="شعار سند" className="h-full w-full scale-[1.18] object-contain" />
            </div>
          </div>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.32em] text-white/70 sm:tracking-[0.55em] sm:text-[11px]">
            S · A · N · A · D — سَنَد
          </div>
        </div>

        <div className="fade-soft mt-6 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/70 sm:tracking-[0.32em]">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-clay" />
          تبرّع عبر Whish — أو تواصل للقنوات الأخرى
        </div>

        <div className="mt-auto max-w-3xl">
          <div className="rise font-display text-3xl leading-[1.08] sm:text-6xl md:text-7xl">
            ليس تبرّعاً.
            <br />
            <span className="text-clay">إنّه موقف.</span>
          </div>
          <p className="rise mt-5 max-w-xl text-[14px] leading-relaxed text-white/85 sm:text-base">
            في سند، لا نطلب منك أن تمنح. نطلب منك أن تقف. تبرّعك يُوجَّه مباشرةً إلى العائلات المعتمدة — بلا وسطاء.
          </p>

          <div className="rise mt-7 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
            <a href="#methods" className="touch-target rounded-full bg-clay px-6 py-3 text-center text-[13px] font-medium text-white transition hover:bg-clay/90 sm:text-sm">
              Whish — تبرّع الآن ↓
            </a>
            <a
              href={telHref(ALT_DONATION_PHONE)}
              className="touch-target rounded-full border border-white/30 px-5 py-3 text-center text-[13px] text-white/90 transition hover:bg-white/10 sm:text-sm"
            >
              قناة أخرى؟ اتصل بنا
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 1. PROMISE ----------------------------- */
function Promise() {
  const items = [
    { n: "٠١", t: "بلا وسطاء.", d: "تبرّعك ينتقل من حسابك إلى يد المسؤول الميداني مباشرةً، بلا سلسلة وكلاء." },
    { n: "٠٢", t: "بالشفافية.", d: "نوضّح أين تُوجَّه التبرّعات — صندوق عام أو حالات معتمدة — دون وسطاء." },
    { n: "٠٣", t: "بالإيصال.", d: "تستلم تأكيداً بصورة فاتورة الشراء وتوقيع العائلة المستفيدة برمز PIN." },
  ];
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
        <Kicker>تعهّدنا لك</Kicker>
        <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
          ثلاثة وعود. مكتوبة. وموقّعة.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.n} className="bg-background p-6 sm:p-8">
              <div className="font-mono text-[11px] text-clay">{it.n}</div>
              <div className="mt-4 font-display text-2xl leading-tight text-foreground sm:text-3xl">{it.t}</div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 5. METHODS ----------------------------- */
function Methods({
  intent,
  onMethodKeyChange,
  onAmountChange,
}: {
  intent: DonationIntent;
  onMethodKeyChange: (key: string) => void;
  onAmountChange: (amount: number) => void;
}) {
  useEffect(() => {
    onMethodKeyChange("whish");
  }, [onMethodKeyChange]);

  return (
    <section id="methods" className="bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
        <Kicker>طرق الدفع</Kicker>
        <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
          Whish Money <span className="text-clay">— الأسرع محلياً.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-base">
          للتبرّع عبر Whish، استخدم الرقم أدناه. للتبرّع عبر مصرف أو PayPal أو أي قناة أخرى،
          تواصل معنا على الرقم الثاني وسنرسل لك التفاصيل.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="order-2 grid gap-5 sm:grid-cols-2 lg:order-1 lg:grid-cols-1">
            <OneClickContact
              label="Whish Money — تحويل مباشر"
              phone={WHISH_DONATION_PHONE}
              display={WHISH_DONATION_DISPLAY}
            />
            <OneClickContact
              label="قنوات أخرى (مصرف، PayPal، OMT…)"
              phone={ALT_DONATION_PHONE}
              display={ALT_DONATION_DISPLAY}
            />
          </div>

          <div className="order-1 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6 lg:order-2">
            <div className="font-display text-xl sm:text-2xl">Whish Money</div>
            <div className="mt-3">
              <CopyRow
                label="رقم Whish"
                value={WHISH_DONATION_DISPLAY}
                href={telHref(WHISH_DONATION_PHONE)}
              />
              <CopyRow label="ملاحظة التحويل" value="Donation — SANAD" />
            </div>
            <div className="mt-5 rounded-lg bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted-foreground sm:text-sm">
              بعد إتمام التحويل، أكمل نموذج التسجيل أدناه مع لقطة الشاشة (إن وُجدت).
              للقنوات غير Whish، اتصل أو راسلنا على{" "}
              <a href={telHref(ALT_DONATION_PHONE)} className="text-clay hover:underline" dir="ltr">
                {ALT_DONATION_DISPLAY}
              </a>
              .
            </div>
          </div>
        </div>

        <DonationSubmitForm
          intent={{ ...intent, methodKey: "whish" }}
          onMethodKeyChange={() => {}}
          onAmountChange={onAmountChange}
        />
      </div>
    </section>
  );
}
function Ledger({ rows }: { rows: LedgerRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Kicker>السجلّ العلني</Kicker>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
              آخر ٥ تحويلات. <span className="text-clay">حرفياً.</span>
            </h2>
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">المجموع المعروض</div>
            <div className="font-display text-2xl text-foreground sm:text-3xl">${total}</div>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-8 space-y-3 md:hidden">
          {rows.length === 0 && (
            <div className="rounded-2xl border border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
              لا توجد تبرّعات موثّقة بعد.
            </div>
          )}
          {rows.map((r) => (
            <div key={r.reference_code} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[12px] text-muted-foreground">{formatLedgerDate(r.created_at)}</div>
                <div className="font-mono text-lg text-foreground">
                  ${Math.round(r.amount)}
                  <span className="ms-1 text-[10px] text-muted-foreground">{r.currency}</span>
                </div>
              </div>
              <div className="mt-3 text-sm text-foreground">{ledgerItemLabel(r)}</div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                {r.beneficiary_code ? (
                  <span dir="ltr" className="font-mono">{formatBeneficiaryLabel(r.beneficiary_code)}</span>
                ) : (
                  formatBeneficiaryLabel(null)
                )}
                {r.donor_display && (
                  <span className="mt-1 block">عبر {r.donor_display}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="table-scroll mt-8 hidden overflow-x-auto rounded-2xl border border-border bg-background md:block">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface/70 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">المستفيد</th>
                <th className="px-4 py-3 font-medium">العنصر</th>
                <th className="px-4 py-3 font-medium">عبر</th>
                <th className="px-4 py-3 text-left font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    لا توجد تبرّعات موثّقة بعد.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.reference_code} className="hover:bg-surface/50">
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{formatLedgerDate(r.created_at)}</td>
                  <td
                    className="px-4 py-3 text-right text-[12px] text-foreground"
                    title={r.beneficiary_code ? "رمز طلب المساعدة للعائلة المدعومة" : "تبرّع للصندوق العام"}
                  >
                    {r.beneficiary_code ? (
                      <span dir="ltr" className="font-mono">
                        {formatBeneficiaryLabel(r.beneficiary_code)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{formatBeneficiaryLabel(null)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{ledgerItemLabel(r)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.donor_display}</td>
                  <td className="px-4 py-3 text-left font-mono text-foreground">
                    ${Math.round(r.amount)}
                    <span className="ms-1 text-[10px] text-muted-foreground">{r.currency}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          عمود «المستفيد» يعرض رمز عائلة مدعومة أو «صندوق عام» للتبرّعات غير المخصّصة. السجل الكامل (آخر ٣٠
          يوماً) ينشر في تقريرنا الشهري.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------- 4. LEDGER ----------------------------- */
function Pledges({ items }: { items: PledgeMessage[] }) {
  const fallback: PledgeMessage[] = [
    { donor_display: "أحمد م.", message: "لأمي التي علّمتني أن الكرم لا يُحسب." },
    { donor_display: "مجهول", message: "لأنّي كنتُ يوماً مكانكم." },
  ];
  const list = items.length > 0 ? items : fallback;

  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
        <Kicker>جدار التعهّدات</Kicker>
        <h2 className="mt-3 font-display text-3xl leading-tight text-white sm:text-4xl md:text-5xl">
          لأنّ المتبرّعين <span className="text-clay">يستحقّون أن يُسمَعوا أيضاً.</span>
        </h2>
        <div className="mt-10 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {list.map((p, i) => (
            <div key={i} className="mb-5 break-inside-avoid rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
              <p className="font-display text-lg leading-snug text-white/95 sm:text-xl">«{p.message}»</p>
              <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/55">
                <span className="h-1 w-4 bg-clay" />{p.donor_display}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="#methods" className="rounded-full bg-white px-5 py-2.5 text-[13px] text-ink hover:bg-clay hover:text-white sm:text-sm">أضف تعهّدك</a>
          <p className="text-[12px] text-white/60 sm:text-sm">يمكن النشر باسم مستعار أو دون اسم.</p>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 7. ACCOUNTABILITY / FAQ ----------------------------- */
const faqs = [
  { q: "هل أحصل على إيصال رسمي؟", a: "نعم — يُرسل بريدياً خلال ٢٤ ساعة، ويحتوي رقم تحويلك وتفاصيل التبرّع." },
  { q: "ما نسبة المصاريف التشغيلية؟", a: "أقل من ٦٪. مفصّلة في التقرير الشهري بنداً بنداً — نشر علني، بلا تنقيح." },
  { q: "كيف أعرف أن المساعدة وصلت فعلاً؟", a: "كل عائلة توقّع باستلام برمز PIN ورمز QR. صورة الاستلام تُرسل لمتبرّعي تلك الحالة." },
  { q: "هل يمكنني التبرّع شهرياً؟", a: `نعم. تواصل معنا على ${ALT_DONATION_DISPLAY} (اتصال أو واتساب) وسنوجّهك لإعداد تحويل شهري.` },
  { q: "هل أنتم منظمة مسجّلة؟", a: "سند مبادرة محلية مستقلة، تعمل تحت غطاء جمعية محلية مسجلة في وزارة الداخلية اللبنانية. الوثائق متاحة عند الطلب." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <Kicker>المساءَلة</Kicker>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
              اسأل ما شئت. <span className="text-clay">نُجيب بالأرقام.</span>
            </h2>
            <p className="mt-4 max-w-md text-[14px] text-muted-foreground sm:text-base">
              لم نُؤسَّس على الثقة العمياء. لو وجدت تناقضاً في أي رقم، اكتب لنا — نُصلح ونعتذر علناً.
            </p>
            <div className="mt-6 rounded-xl border border-border bg-surface/60 p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">للتدقيق و الاستفسار</div>
              <div className="mt-1 font-display text-lg text-foreground">audit@sanad.lb</div>
              <a href={telHref(ALT_DONATION_PHONE)} className="mt-1 block font-mono text-sm text-clay hover:underline" dir="ltr">
                {ALT_DONATION_DISPLAY}
              </a>
            </div>
          </div>

          <ul className="divide-y divide-border border-y border-border">
            {faqs.map((f, i) => (
              <li key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full min-h-11 items-center justify-between gap-4 py-4 text-right"
                >
                  <span className="min-w-0 flex-1 font-display text-base leading-snug text-foreground sm:text-lg">{f.q}</span>
                  <span className={["shrink-0 font-mono text-lg text-clay transition", open === i ? "rotate-45" : ""].join(" ")}>+</span>
                </button>
                {open === i && (
                  <p className="pb-5 pe-2 ps-6 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{f.a}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 8. CTA ----------------------------- */
function FinalCTA() {
  return (
    <section className="relative isolate overflow-hidden bg-clay text-white">
      <div className="absolute inset-0 grain opacity-40" />
      <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-white/70">قِف معنا</div>
        <h2 className="mt-4 font-display text-3xl leading-[1.05] sm:text-5xl md:text-6xl">
          الليلة، عائلةٌ ستنام أكثر دفئاً
          <br />
          <span className="text-white/85">— إذا قرّرتَ ذلك أنت.</span>
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#methods" className="rounded-full bg-white px-7 py-3.5 text-[14px] font-medium text-clay transition hover:bg-ink hover:text-white sm:text-base">
            تبرّع الآن
          </a>
          <Link to="/" className="rounded-full border border-white/40 px-6 py-3.5 text-[14px] text-white transition hover:bg-white/10 sm:text-base">
            قدّم طلب مساعدة
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- PAGE ----------------------------- */
function DonatePage() {
  const [intent, setIntent] = useState<DonationIntent>({
    amount: 0,
    methodKey: "whish",
    pledgedRequestId: null,
    pledgedRequestCode: null,
  });
  const { data: ledger = [] } = usePublicLedger(10);
  const [pledges, setPledges] = useState<PledgeMessage[]>([]);
  useEffect(() => {
    void (async () => {
      try {
        setPledges(await fetchRecentDonationMessages(6));
      } catch (err) {
        if (import.meta.env.DEV) console.error("[Donate pledges]", err);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <PublicNav tone="dark" />
      <Hero />
      <Promise />
      <DonationJourney />
      <Methods
        intent={intent}
        onMethodKeyChange={() => {}}
        onAmountChange={(amount) => setIntent((p) => ({ ...p, amount }))}
      />
      <Ledger rows={ledger} />
      <Pledges items={pledges} />
      <Faq />
      <FinalCTA />
      <PublicFooter />
    </main>
  );
}
