import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DonationSubmitForm, type DonationIntent } from "@/components/DonationSubmitForm";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import {
  fetchAdoptableFamilies,
  fetchDonationImpactStats,
  fetchDonationProofPhotos,
  fetchPublicLedger,
  fetchRecentDonationMessages,
  formatBeneficiaryLabel,
  formatLedgerDate,
  ledgerItemLabel,
  type AdoptableFamily,
  type DonationImpactStats,
  type DonationProofPhotoRow,
  type LedgerRow,
  type PledgeMessage,
} from "@/lib/donations";
import hero1 from "@/assets/hero-1.jpg";
import hero3 from "@/assets/hero-3.jpg";
import hero4 from "@/assets/hero-4.jpg";
import { proofPhotoSrcMap } from "@/lib/donate-photos";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "تبرّع — سند" },
      { name: "description", content: "تبرّعك ليس رقماً. إنه وجبة، حفاضة، دواء. ادعم عائلة محددة، وتابع أين ذهبت كل ليرة." },
      { property: "og:title", content: "تبرّع — سند" },
      { property: "og:image", content: hero1 },
    ],
  }),
  component: DonatePage,
});

/* ----------------------------- atoms ----------------------------- */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const s = performance.now(); const d = 1400; let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - s) / d);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span>{n.toLocaleString("ar-EG")}{suffix}</span>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-clay sm:text-[11px]">{children}</p>;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [c, setC] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div dir="ltr" className="mt-0.5 truncate font-mono text-[13px] text-foreground">{value}</div>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1200); }}
        className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:border-clay hover:text-clay"
      >
        {c ? "نُسخ ✓" : "نسخ"}
      </button>
    </div>
  );
}

/* ----------------------------- HERO (Ken-Burns cycling) ----------------------------- */
const heroFrames = [
  { src: hero1, kb: "kb-1" },
  { src: hero3, kb: "kb-3" },
  { src: hero4, kb: "kb-4" },
];

type ProofPhoto = { src: string; label: string };

function DonationProofs({ photos }: { photos: ProofPhoto[] }) {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
        <Kicker>رحلة التبرع</Kicker>
        <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
          هذه الصور تعرض رحلة المبلغ من التبرع إلى التوزيع
        </h2>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-base">
          نقسم هنا بعض صور الوثائق التي جمعناها من عمليات الشراء والتوزيع الفعلية، لتوضيح كيف تتحول كل مساهمة إلى مساعدة ملموسة.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proofPhotos.map((photo) => (
            <div key={photo.src} className="overflow-hidden rounded-3xl border border-border bg-card">
              <img src={photo.src} alt={photo.label} className="h-64 w-full object-cover" />
              <div className="px-4 py-3 text-sm text-muted-foreground">{photo.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Hero({ stats }: { stats: DonationImpactStats }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % heroFrames.length), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="relative isolate min-h-[88vh] overflow-hidden bg-ink text-white">
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
      <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col px-5 pb-12 pt-28 sm:px-6 sm:pt-32 lg:px-10">
        <div className="fade-soft flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/70">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-clay" />
          توزيع جارٍ — قضاء صور، الآن
        </div>

        <div className="mt-auto max-w-3xl">
          <div className="rise font-display text-4xl leading-[1.05] sm:text-6xl md:text-7xl">
            ليس تبرّعاً.
            <br />
            <span className="text-clay">إنّه موقف.</span>
          </div>
          <p className="rise mt-5 max-w-xl text-[14px] leading-relaxed text-white/85 sm:text-base">
            في سند، لا نطلب منك أن تمنح. نطلب منك أن تقف. أن تختار عائلة، وتعرف اسمها، وتعرف ماذا اشترت لها ليرتك. هذه ليست صدقة عابرة — هذا التزام بشهادة.
          </p>

          <div className="rise mt-7 flex flex-wrap items-center gap-3">
            <a href="#allocate" className="rounded-full bg-clay px-6 py-3 text-[13px] font-medium text-white transition hover:bg-clay/90 sm:text-sm">
              اختر مبلغك ↓
            </a>
            <a href="#families" className="rounded-full border border-white/30 px-5 py-3 text-[13px] text-white/90 transition hover:bg-white/10 sm:text-sm">
              تبنَّ عائلة بالاسم
            </a>
          </div>
        </div>

        {/* live ticker bar */}
        <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm">
          {[
            { k: "الأسبوع الحالي", v: Math.round(stats.week_total_usd), suf: "$" },
            { k: "عائلات تمّ دعمها", v: stats.families_helped, suf: "" },
            {
              k: "آخر تبرّع منذ",
              v: stats.last_donation_minutes ?? 0,
              suf: stats.last_donation_minutes != null ? " د" : "",
            },
          ].map((s) => (
            <div key={s.k} className="bg-ink/40 p-4 text-center sm:p-5">
              <div className="font-display text-2xl text-white sm:text-3xl">
                <Counter to={s.v} suffix={s.suf} />
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60 sm:text-[11px]">{s.k}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 1. PROMISE ----------------------------- */
function Promise() {
  const items = [
    { n: "٠١", t: "بلا وسطاء.", d: "تبرّعك ينتقل من حسابك إلى يد المسؤول الميداني مباشرةً، بلا سلسلة وكلاء." },
    { n: "٠٢", t: "بالاسم.", d: "تختار عائلة محددة من قائمة الطلبات المعتمدة. تعرف منطقتها، حجمها، حاجتها." },
    { n: "٠٣", t: "بالإيصال.", d: "تستلم تأكيداً بصورة فاتورة الشراء وتوقيع العائلة المستفيدة برمز PIN." },
  ];
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
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

/* ----------------------------- 2. ALLOCATE — interactive ----------------------------- */
const allocations = [
  { amt: 10, label: "حليب رضيع لأسبوع", recipient: "SND-19203 — كفررمان", icon: "🍼" },
  { amt: 25, label: "سلة طعام أساسية ٤ أيام", recipient: "SND-88471 — حاصبيا", icon: "🥖" },
  { amt: 50, label: "دواء قلب شهري", recipient: "SND-19203 — مرجعيون", icon: "💊" },
  { amt: 100, label: "إيجار مأوى لأسبوع", recipient: "عائلة من ٦ — صور", icon: "🏚" },
  { amt: 250, label: "دعم شامل عائلة شهرياً", recipient: "تحديد عشوائي — أولوية قصوى", icon: "✦" },
];

function Allocate({
  amount,
  onAmountChange,
}: {
  amount: number;
  onAmountChange: (amount: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const eff = custom ? Number(custom) || 0 : amount;
  const match = useMemo(() => {
    // find nearest matching allocation tier <= eff
    const sorted = [...allocations].sort((a, b) => a.amt - b.amt);
    let chosen = sorted[0];
    for (const a of sorted) if (a.amt <= eff) chosen = a;
    return chosen;
  }, [eff]);

  return (
    <section id="allocate" className="bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <Kicker>اختَر أثرك</Kicker>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
              لكل مبلغ <span className="text-clay">قصّة محدّدة.</span>
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-muted-foreground sm:text-base">
              مرِّر بين المبالغ. سترى تماماً ما الذي ستشتريه ليرتك، ومن سيستلمها هذا الأسبوع.
            </p>

            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">المبلغ بالدولار</div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {allocations.map((a) => (
                  <button
                    key={a.amt}
                    type="button"
                    onClick={() => { onAmountChange(a.amt); setCustom(""); }}
                    className={[
                      "rounded-xl border px-2 py-3 font-display text-base transition sm:text-lg",
                      eff === a.amt && !custom ? "border-clay bg-clay text-white" : "border-border bg-background hover:border-clay/60",
                    ].join(" ")}
                  >${a.amt}</button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                <span className="font-mono text-sm text-muted-foreground">$</span>
                <input
                  type="number" inputMode="decimal" min={1} placeholder="مبلغ مخصص"
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    const val = Number(e.target.value);
                    if (val > 0) onAmountChange(val);
                  }}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* visual receipt card */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
              <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-clay/10 blur-3xl" />
              <div className="relative flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">إيصالك المستقبلي</div>
                <div className="font-mono text-[10px] text-muted-foreground">SANAD · {new Date().getFullYear()}</div>
              </div>

              <div className="mt-6 flex items-baseline gap-3">
                <div className="font-display text-6xl leading-none text-foreground sm:text-7xl">${eff || 0}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">USD</div>
              </div>

              <div className="mt-8 rounded-xl bg-surface p-5">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{match.icon}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ستشتري</div>
                    <div className="mt-1 font-display text-xl leading-tight text-foreground sm:text-2xl">{match.label}</div>
                    <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">للمستفيد</div>
                    <div dir="ltr" className="mt-1 font-mono text-sm text-foreground">{match.recipient}</div>
                  </div>
                </div>
              </div>

              {eff > match.amt && (
                <div className="mt-4 rounded-lg border border-clay/30 bg-clay/5 px-4 py-3 text-[12px] leading-relaxed text-foreground sm:text-sm">
                  المتبقّي <span className="font-mono text-clay">${eff - match.amt}</span> سيُضاف إلى صندوق الطوارئ للحالات الحرجة هذا الأسبوع.
                </div>
              )}

              <a href="#methods" className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background transition hover:bg-clay sm:text-sm">
                أكمل التبرّع بـ ${eff || 0} <span>←</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 3. ADOPT A FAMILY ----------------------------- */
function Families({
  families,
  selectedCode,
  onAdopt,
}: {
  families: AdoptableFamily[];
  selectedCode: string | null;
  onAdopt: (requestId: string, code: string) => void;
}) {
  return (
    <section id="families" className="bg-background">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <Kicker>تبنَّ عائلة</Kicker>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
              {families.length > 0 ? (
                <>عائلات معتمدة <span className="text-clay">تنتظر دعمك.</span></>
              ) : (
                <>لا توجد عائلات معتمدة <span className="text-clay">حالياً.</span></>
              )}
            </h2>
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">آخر تحديث</div>
            <div className="font-mono text-sm text-foreground">منذ ١٢ دقيقة</div>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {families.map((f) => {
            const pct = f.goal > 0 ? Math.min(100, Math.round((f.raised / f.goal) * 100)) : 0;
            const selected = selectedCode === f.reference_code;
            return (
              <article
                key={f.request_id}
                className={[
                  "group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-clay/50 hover:shadow-lg",
                  selected ? "border-clay ring-1 ring-clay/30" : "border-border",
                ].join(" ")}
              >
                <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-3">
                  <div dir="ltr" className="font-mono text-[12px] text-foreground">{f.reference_code}</div>
                  <span className="rounded-full bg-clay/10 px-2.5 py-0.5 text-[10px] font-medium text-clay">{f.tag}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="text-[13px] text-muted-foreground sm:text-sm">{f.region}</div>
                  <div className="mt-3 flex items-baseline gap-5 text-[12px] sm:text-sm">
                    <div><span className="font-display text-xl text-foreground sm:text-2xl">{f.family_size}</span> <span className="text-muted-foreground">فرد</span></div>
                    {f.infants > 0 && (
                      <div><span className="font-display text-xl text-foreground sm:text-2xl">{f.infants}</span> <span className="text-muted-foreground">رضيع</span></div>
                    )}
                  </div>
                  {f.needs_summary && (
                    <div className="mt-3 text-[12px] leading-relaxed text-foreground sm:text-sm">
                      <span className="text-muted-foreground">يحتاجون: </span>{f.needs_summary}
                    </div>
                  )}

                  <div className="mt-6 flex-1" />
                  <div>
                    <div className="flex items-baseline justify-between text-[11px] sm:text-xs">
                      <div className="font-mono text-foreground">${Math.round(f.raised)} / ${Math.round(f.goal)}</div>
                      <div className="text-muted-foreground">{pct}%</div>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-clay transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAdopt(f.request_id, f.reference_code)}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-foreground/80 py-2.5 text-[13px] font-medium text-foreground transition group-hover:bg-foreground group-hover:text-background sm:text-sm"
                  >
                    {selected ? "✓ مختارة — أكمل التبرّع ↓" : "ادعم هذه العائلة ←"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 4. LEDGER ----------------------------- */
function Ledger({ rows }: { rows: LedgerRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
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

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-background">
          <table className="w-full text-right text-[13px] sm:text-sm">
            <thead className="bg-surface/70 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">التاريخ</th>
                <th className="px-4 py-3 font-medium">المستفيد</th>
                <th className="px-4 py-3 font-medium">العنصر</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">عبر</th>
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
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground sm:px-5">{formatLedgerDate(r.created_at)}</td>
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
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{r.donor_display}</td>
                  <td className="px-4 py-3 text-left font-mono text-foreground">
                    ${Math.round(r.amount)}
                    <span className="ms-1 text-[10px] text-muted-foreground">{r.currency}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground sm:text-xs">
          عمود «المستفيد» يعرض رمز عائلة مدعومة أو «صندوق عام» للتبرّعات غير المخصّصة. السجل الكامل (آخر ٣٠
          يوماً) ينشر في تقريرنا الشهري.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------- 5. METHODS ----------------------------- */
const methods = [
  { key: "whish", name: "Whish Money", note: "أسرع طريقة محلياً", fields: [
    { l: "رقم المحفظة", v: "+961 71 234 567" },
    { l: "اسم المستفيد", v: "Sanad NGO" },
    { l: "ملاحظة التحويل", v: "Donation — SANAD" },
  ]},
  { key: "bank", name: "تحويل مصرفي", note: "للمساهمات الكبيرة", fields: [
    { l: "اسم المصرف", v: "Bank Audi" },
    { l: "رقم الحساب IBAN", v: "LB45 0056 0000 0000 1234 5678 9012" },
    { l: "اسم صاحب الحساب", v: "Sanad Lebanon SAL" },
  ]},
  { key: "omt", name: "OMT / WU", note: "نقداً من أي فرع", fields: [
    { l: "اسم المستفيد", v: "Mohammad H." },
    { l: "رقم الهاتف", v: "+961 70 998 113" },
    { l: "العملات المقبولة", v: "USD / LBP" },
  ]},
  { key: "paypal", name: "PayPal", note: "للخارج", fields: [
    { l: "البريد الإلكتروني", v: "give@sanad.lb" },
    { l: "العملات المقبولة", v: "USD / EUR / GBP" },
    { l: "ملاحظة الرسوم", v: "PayPal يخصم ٣.٥٪ تقريباً" },
  ]},
];

function Methods({
  intent,
  onMethodKeyChange,
}: {
  intent: DonationIntent;
  onMethodKeyChange: (key: string) => void;
}) {
  const [active, setActive] = useState(intent.methodKey || methods[0].key);
  const m = methods.find((x) => x.key === active)!;

  useEffect(() => {
    onMethodKeyChange(active);
  }, [active, onMethodKeyChange]);

  return (
    <section id="methods" className="bg-background">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
        <Kicker>طرق الدفع</Kicker>
        <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
          اختر القناة. <span className="text-clay">الباقي علينا.</span>
        </h2>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div className="grid grid-cols-2 gap-3">
            {methods.map((x) => (
              <button
                key={x.key}
                onClick={() => setActive(x.key)}
                className={[
                  "rounded-xl border p-4 text-right transition",
                  active === x.key ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
                ].join(" ")}
              >
                <div className="font-display text-lg sm:text-xl">{x.name}</div>
                <div className={["mt-1 text-[11px] sm:text-xs", active === x.key ? "text-background/70" : "text-muted-foreground"].join(" ")}>{x.note}</div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface/50 p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <div className="font-display text-xl sm:text-2xl">{m.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.note}</div>
            </div>
            <div className="mt-3">
              {m.fields.map((f) => <CopyRow key={f.l} label={f.l} value={f.v} />)}
            </div>
            <div className="mt-5 rounded-lg bg-background px-4 py-3 text-[12px] leading-relaxed text-muted-foreground sm:text-sm">
              بعد إتمام التحويل، أكمل نموذج التسجيل أدناه مع لقطة الشاشة (إن وُجدت).
            </div>
          </div>
        </div>
        <DonationSubmitForm intent={{ ...intent, methodKey: active }} onMethodKeyChange={setActive} />
      </div>
    </section>
  );
}

/* ----------------------------- 6. PLEDGE WALL ----------------------------- */
function Pledges({ items }: { items: PledgeMessage[] }) {
  const fallback: PledgeMessage[] = [
    { donor_display: "أحمد م.", message: "لأمي التي علّمتني أن الكرم لا يُحسب." },
    { donor_display: "مجهول", message: "لأنّي كنتُ يوماً مكانكم." },
  ];
  const list = items.length > 0 ? items : fallback;

  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
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
  { q: "هل أحصل على إيصال رسمي؟", a: "نعم — يُرسل بريدياً خلال ٢٤ ساعة، ويحتوي رقم تحويلك والعائلة المستفيدة (إن اخترتها)." },
  { q: "ما نسبة المصاريف التشغيلية؟", a: "أقل من ٦٪. مفصّلة في التقرير الشهري بنداً بنداً — نشر علني، بلا تنقيح." },
  { q: "كيف أعرف أن المساعدة وصلت فعلاً؟", a: "كل عائلة توقّع باستلام برمز PIN ورمز QR. صورة الاستلام تُرسل لمتبرّعي تلك الحالة." },
  { q: "هل يمكنني التبرّع شهرياً؟", a: "نعم. أرسل لنا 'شهري' على واتساب وسنوجّهك لإعداد تحويل تلقائي عبر مصرفك أو Whish." },
  { q: "هل أنتم منظمة مسجّلة؟", a: "سند مبادرة محلية مستقلة، تعمل تحت غطاء جمعية محلية مسجلة في وزارة الداخلية اللبنانية. الوثائق متاحة عند الطلب." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-10">
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
              <div className="mt-1 font-mono text-sm text-foreground" dir="ltr">+961 70 000 000</div>
            </div>
          </div>

          <ul className="divide-y divide-border border-y border-border">
            {faqs.map((f, i) => (
              <li key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-right"
                >
                  <span className="font-display text-base text-foreground sm:text-lg">{f.q}</span>
                  <span className={["font-mono text-clay transition", open === i ? "rotate-45" : ""].join(" ")}>+</span>
                </button>
                {open === i && (
                  <p className="pb-5 pl-6 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{f.a}</p>
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
      <div className="relative mx-auto max-w-4xl px-5 py-16 text-center sm:px-6 sm:py-24 lg:px-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-white/70">قِف معنا</div>
        <h2 className="mt-4 font-display text-3xl leading-[1.05] sm:text-5xl md:text-6xl">
          الليلة، عائلةٌ ستنام أكثر دفئاً
          <br />
          <span className="text-white/85">— إذا قرّرتَ ذلك أنت.</span>
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#allocate" className="rounded-full bg-white px-7 py-3.5 text-[14px] font-medium text-clay transition hover:bg-ink hover:text-white sm:text-base">
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
    amount: 25,
    methodKey: "whish",
    pledgedRequestId: null,
    pledgedRequestCode: null,
  });
  const [stats, setStats] = useState<DonationImpactStats>({
    week_total_usd: 0,
    families_helped: 0,
    last_donation_minutes: null,
  });
  const [families, setFamilies] = useState<AdoptableFamily[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [pledges, setPledges] = useState<PledgeMessage[]>([]);
  const [proofPhotos, setProofPhotos] = useState<ProofPhoto[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [s, f, l, p] = await Promise.all([
          fetchDonationImpactStats(),
          fetchAdoptableFamilies(10),
          fetchPublicLedger(10),
          fetchRecentDonationMessages(6),
        ]);
        setStats(s);
        setFamilies(f);
        setLedger(l);
        setPledges(p);
      } catch (err) {
        if (import.meta.env.DEV) console.error("[Donate]", err);
      }

      try {
        const photos = await fetchDonationProofPhotos();
        setProofPhotos(
          photos
            .map((row) => ({ src: proofPhotoSrcMap[row.asset_key] ?? "", label: row.label }))
            .filter((photo) => photo.src),
        );
      } catch (err) {
        if (import.meta.env.DEV) console.error("[Donate proof photos]", err);
      }
    })();
  }, []);

  const handleMethodKeyChange = (key: string) => {
    setIntent((prev) => ({ ...prev, methodKey: key }));
  };

  return (
    <main className="min-h-screen bg-background">
      <PublicNav tone="dark" />
      <Hero stats={stats} />
      <Promise />
      {proofPhotos.length > 0 && <DonationProofs photos={proofPhotos} />}
      <Allocate amount={intent.amount} onAmountChange={(amount) => setIntent((p) => ({ ...p, amount }))} />
      <Families
        families={families}
        selectedCode={intent.pledgedRequestCode}
        onAdopt={(requestId, code) =>
          setIntent((p) => ({ ...p, pledgedRequestId: requestId, pledgedRequestCode: code }))
        }
      />
      <Ledger rows={ledger} />
      <Methods intent={intent} onMethodKeyChange={handleMethodKeyChange} />
      <Pledges items={pledges} />
      <Faq />
      <FinalCTA />
      <PublicFooter />
    </main>
  );
}
