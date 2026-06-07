import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicQrCard } from "@/components/PublicQrCard";
import { usePublicSiteConfig } from "@/lib/use-public-site-config";
import { insertSubmissionReference } from "@/lib/submission-reference";
import { submitAidRequest } from "@/lib/submit-aid-request";
import { uploadIdDocument } from "@/lib/upload-id-doc";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { useDonationImpactStats, type DonationImpactStats } from "@/lib/donations";
import { aidRequestHeroPhoto, sanadLogoPhoto } from "@/lib/donate-photos";
import { getSubmissionStatus } from "@/lib/submission-status";
import { precheckAidSubmission, type PrecheckReason } from "@/lib/precheck-aid-submission";
import { validateAidRequestForm } from "@/lib/aid-request-validation";
import {
  DOC_TYPE_LABELS,
  documentTypeFromLabel,
  isLebanesePhone,
} from "@/lib/phone-normalize";
import { CapReachedMessage } from "@/components/CapReachedMessage";
import { DuplicateSubmissionAlert } from "@/components/DuplicateSubmissionAlert";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سند — قدّم طلب مساعدة" },
      { name: "description", content: "نموذج تقديم طلب مساعدة للعائلات النازحة في الجنوب اللبناني. بيانات سرّية ومحميّة." },
    ],
  }),
  component: RequestHome,
});

/* ----------------------------- constants ----------------------------- */
const REGIONS = ["قضاء صور", "قضاء بنت جبيل", "قضاء مرجعيون", "قضاء النبطية", "قضاء حاصبيا", "منطقة أخرى"];
const SHELTERS = ["مدرسة", "مأوى جماعي", "عند أهل أو أصدقاء", "منزل مستأجر", "أخرى"];
const NEEDS = [
  "طعام", "ملابس", "أدوية", "وسائد وفرش", "حفاضات", "حليب أطفال",
  "مروحة", "غاز", "مساعدة مالية", "مواد نظافة", "أغطية وبطانيات", "أخرى",
];
const REF_TYPES = ["مختار", "شيخ البلد", "رجل دين", "مسؤول بلدية", "طبيب معروف", "معلم أو مدير مدرسة", "مسؤول جمعية", "أخرى"];
const KNOWN = ["أقل من سنة", "١–٥ سنوات", "أكثر من ٥ سنوات", "طوال عمري"];
const DOC_TYPES = [DOC_TYPE_LABELS.lebanese_id, DOC_TYPE_LABELS.passport];
const DIAPER_SIZES = ["NB", "١", "٢", "٣", "٤", "٥", "٦"];
const MILK_BRANDS = ["Aptamil", "NAN", "Similac", "Enfamil", "أي ماركة متوفرة"];
const MILK_STAGES = ["Stage 1 (٠–٦ أشهر)", "Stage 2 (٦–١٢ شهر)", "Stage 3 (١٢–٢٤ شهر)"];
const FIN_PURPOSE = ["إيجار مؤقت", "مصاريف طبية", "مستلزمات أساسية", "مصاريف تعليم", "أخرى"];

const DEFAULT_STATS: DonationImpactStats = {
  week_total_usd: 0,
  families_helped: 0,
  last_donation_minutes: null,
  requests_received: 0,
  verify_rate: 0,
  avg_response_minutes: null,
};

/* ----------------------------- validation helpers ----------------------------- */
function monthsAgo(d: string) {
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
}

/* ----------------------------- ui atoms ----------------------------- */
const inputCls =
  "w-full rounded-lg border border-border bg-background px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";
const inputErrCls =
  "w-full rounded-lg border border-destructive/60 bg-destructive/5 px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20";

function cls(err: boolean) {
  return err ? inputErrCls : inputCls;
}

function SectionTitle({ n, title, sub, id }: { n: string; title: string; sub?: string; id: string }) {
  return (
    <div id={id} className="mb-5 flex items-baseline gap-3 border-b border-border pb-3 sm:gap-4 sm:pb-4">
      <span className="font-mono text-[11px] text-clay sm:text-xs">{n}</span>
      <div>
        <h2 className="font-display text-xl text-foreground sm:text-2xl">{title}</h2>
        {sub && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{sub}</p>}
      </div>
    </div>
  );
}

function Field({
  label, children, hint, required, error,
}: { label: string; children: React.ReactNode; hint?: string; required?: boolean; error?: string | null }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-foreground sm:text-sm">
          {label} {required && <span className="text-clay">*</span>}
        </span>
        {hint && !error && <span className="text-[10px] text-muted-foreground sm:text-[11px]">{hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1 text-[11px] text-destructive sm:text-xs">{error}</div>}
    </label>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-[14px] hover:border-foreground/30 sm:text-sm"
      aria-pressed={on}
    >
      <span>{label}</span>
      <span className={["relative h-6 w-11 rounded-full transition", on ? "bg-clay" : "bg-muted"].join(" ")}>
        <span className={["absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", on ? "right-0.5" : "right-5"].join(" ")} />
      </span>
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={[
        "rounded-full border px-3.5 py-1.5 text-[13px] transition sm:px-4 sm:py-2 sm:text-sm",
        on ? "border-clay bg-clay text-white" : "border-border bg-background hover:border-clay/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-warning sm:text-xs">
      {children}
    </div>
  );
}

/* ----------------------------- stat counter ----------------------------- */
function Counter({ to, suffix }: { to: number; suffix: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <span className="font-display text-2xl sm:text-3xl md:text-4xl">
      {n.toLocaleString("ar-EG")}{suffix}
    </span>
  );
}

/* ----------------------------- success screen ----------------------------- */
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
          <div dir="ltr" className="font-mono text-xl text-foreground sm:text-3xl">{code}</div>
          <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-clay"
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
        <button onClick={onReset} className="rounded-full border border-border px-5 py-3 text-sm hover:border-foreground/40">تقديم طلب جديد</button>
        <Link to="/donate" className="rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground hover:bg-primary/90">صفحة التبرّع</Link>
        <Link to="/track" className="rounded-full border border-border px-5 py-3 text-sm hover:border-clay">تتبّع طلبك</Link>
      </div>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */
function RequestHome() {
  const [submitted, setSubmitted] = useState<{ code: string; id: string } | null>(null);
  const startedAt = useRef<number>(Date.now());

  // -------- form state
  const [first, setFirst] = useState(""); const [father, setFather] = useState(""); const [family, setFamily] = useState("");
  const [phone, setPhone] = useState(""); const [phone2, setPhone2] = useState("");
  const [total, setTotal] = useState(""); const [u12, setU12] = useState(""); const [u2, setU2] = useState("");
  const [hasElderly, setHasElderly] = useState(false); const [elderlyN, setElderlyN] = useState("");
  const [hasDisabled, setHasDisabled] = useState(false); const [disabledDesc, setDisabledDesc] = useState("");
  const [hasChronic, setHasChronic] = useState(false); const [chronicDesc, setChronicDesc] = useState("");
  const [pregnantOrNursing, setPregnantOrNursing] = useState(false);
  const [displaced, setDisplaced] = useState(false);
  const [origin, setOrigin] = useState(""); const [originVillage, setOriginVillage] = useState("");
  const [currentLoc, setCurrentLoc] = useState(""); const [shelter, setShelter] = useState(""); const [shelterName, setShelterName] = useState("");
  const [dispDate, setDispDate] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [diaperSize, setDiaperSize] = useState(""); const [infantAge, setInfantAge] = useState("");
  const [milkBrand, setMilkBrand] = useState(""); const [milkStage, setMilkStage] = useState(""); const [milkAge, setMilkAge] = useState("");
  const [meds, setMeds] = useState(""); const [hasPrescription, setHasPrescription] = useState(false); const [critical, setCritical] = useState(false);
  const [finPurpose, setFinPurpose] = useState("");
  const [clothesDesc, setClothesDesc] = useState(""); const [otherDesc, setOtherDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [refType, setRefType] = useState(""); const [refName, setRefName] = useState(""); const [refPhone, setRefPhone] = useState("");
  const [refRegion, setRefRegion] = useState(""); const [refVillage, setRefVillage] = useState(""); const [refKnown, setRefKnown] = useState(""); const [refNotes, setRefNotes] = useState("");
  const [docType, setDocType] = useState(""); const [docNumber, setDocNumber] = useState(""); const [docExpiry, setDocExpiry] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null); const [docPreview, setDocPreview] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [acceptingSubmissions, setAcceptingSubmissions] = useState<boolean | null>(null);
  const [capMessage, setCapMessage] = useState<string | null>(null);
  const [precheckBlocked, setPrecheckBlocked] = useState<{
    reason: Extract<PrecheckReason, "phone_already_submitted" | "id_already_submitted">;
    message: string;
    reference_code?: string | null;
  } | null>(null);
  const [submitBlocked, setSubmitBlocked] = useState(false);
  const { data: publicStats = DEFAULT_STATS } = useDonationImpactStats();

  // -------- touched / submit-attempted
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const touch = (k: string) => () => setTouched((p) => ({ ...p, [k]: true }));
  const show = (k: string) => attempted || touched[k];

  const showSchoolName = shelter === "مدرسة" || shelter === "مأوى جماعي";
  const toggleNeed = (n: string) => setNeeds((arr) => arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n]);
  const hasNeed = (n: string) => needs.includes(n);
  const documentType = documentTypeFromLabel(docType);

  useEffect(() => {
    let cancelled = false;
    void getSubmissionStatus().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAcceptingSubmissions(result.status.accepting);
        setCapMessage(result.status.message_ar ?? null);
      } else {
        setAcceptingSubmissions(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!phone.trim() || !isLebanesePhone(phone)) {
      setPrecheckBlocked(null);
      setSubmitBlocked(false);
      return;
    }

    const docReady = Boolean(documentType && docNumber.trim());
    const timer = window.setTimeout(() => {
      void precheckAidSubmission({
        phone: phone.trim(),
        ...(docReady
          ? { national_id: docNumber.trim(), document_type: documentType }
          : {}),
      }).then((result) => {
        if (!result.ok) return;
        if (!result.allowed) {
          if (
            result.reason === "phone_already_submitted" ||
            result.reason === "id_already_submitted"
          ) {
            setPrecheckBlocked({
              reason: result.reason,
              message: result.message,
              reference_code: result.reference_code,
            });
            setSubmitBlocked(true);
          } else {
            setPrecheckBlocked(null);
            setSubmitBlocked(false);
          }
          return;
        }
        setPrecheckBlocked(null);
        setSubmitBlocked(false);
      });
    }, docReady ? 400 : 600);

    return () => window.clearTimeout(timer);
  }, [phone, docNumber, documentType, docType]);

  const heroStats = [
    { num: publicStats.requests_received, suffix: "", label: "طلب مستلم" },
    { num: publicStats.families_helped, suffix: "", label: "عائلة وصلتها مساعدة" },
    { num: publicStats.verify_rate, suffix: "%", label: "نسبة التحقق" },
    { num: publicStats.avg_response_minutes ?? 0, suffix: " س", label: "متوسّط زمن الاستجابة" },
  ];

  // -------- file handling
  const onFile = (f: File | null) => {
    setDocError(null);
    if (!f) { setDocFile(null); setDocPreview(null); return; }
    if (f.size > 5 * 1024 * 1024) { setDocError("يرجى التحقق — حجم الملف يجب ألا يتجاوز ٥ ميغابايت"); return; }
    const okType = ["image/jpeg", "image/png", "application/pdf"].includes(f.type);
    if (!okType) { setDocError("يرجى التحقق — الملفات المقبولة هي JPG أو PNG أو PDF فقط"); return; }
    setDocFile(f); setDocPreview(null);
    if (f.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = () => setDocPreview(r.result as string);
      r.readAsDataURL(f);
    }
  };

  // -------- validation (computed)
  const errors = validateAidRequestForm({
    first, father, family, phone, phone2, total, u12, u2,
    hasElderly, elderlyN, hasDisabled, disabledDesc, hasChronic, chronicDesc,
    critical, pregnantOrNursing, displaced, origin, originVillage, currentLoc,
    shelter, shelterName, showSchoolName, dispDate, needs, hasNeed,
    diaperSize, infantAge, milkBrand, milkStage, milkAge, meds, finPurpose,
    clothesDesc, otherDesc, refType, refName, refPhone, refRegion, refKnown,
    docTypeLabel: docType, docNumber, docFile,
  });

  const isValid = Object.keys(errors).length === 0;
  const u2N = Number(u2);

  // -------- soft warnings (not blocking)
  const warnings: string[] = [];
  if (displaced && dispDate && monthsAgo(dispDate) > 6) warnings.push("مرّ أكثر من ٦ أشهر على تاريخ النزوح — يرجى التأكد من صحة التاريخ.");
  if (needs.length >= 9) warnings.push("اخترت عدداً كبيراً من الاحتياجات — يرجى التأكد من أنها جميعاً ضرورية فعلاً.");
  if (u2N > 0 && !hasNeed("حفاضات") && !hasNeed("حليب أطفال")) warnings.push("لديك رضّع في العائلة — هل تحتاج إلى حفاضات أو حليب أطفال؟");

  // -------- submit
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setSubmitError(null);
    if (!isValid || submitBlocked) {
      const firstKey = Object.keys(errors)[0];
      const el = formRef.current?.querySelector(`[data-err="${firstKey}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const elapsed = (Date.now() - startedAt.current) / 1000;
    if (elapsed < 90 && !confirm("يرجى مراجعة إجاباتك قبل الإرسال — هل أنت متأكد من صحة جميع المعلومات؟")) return;

    setSubmitting(true);
    try {
      const fullName = [first, father, family].map((s) => s.trim()).filter(Boolean).join(" ");
      const needsAll = [
        ...needs,
        hasNeed("حفاضات") && diaperSize ? `حفاضات:${diaperSize}` : null,
        hasNeed("حليب أطفال") && milkBrand ? `حليب:${milkBrand}/${milkStage}` : null,
        hasNeed("أدوية") && meds ? `أدوية:${meds.slice(0, 120)}` : null,
        hasNeed("مساعدة مالية") && finPurpose ? `مالية:${finPurpose}` : null,
        hasNeed("ملابس") && clothesDesc ? `ملابس:${clothesDesc.slice(0, 120)}` : null,
        hasNeed("أخرى") && otherDesc ? `أخرى:${otherDesc.slice(0, 200)}` : null,
      ].filter(Boolean) as string[];

      const deviceFingerprint = await getDeviceFingerprint();

      const payload = {
        full_name: fullName,
        phone: phone.trim(),
        alt_phone: phone2.trim() || null,
        national_id: docNumber.trim(),
        document_type: documentType!,
        governorate: origin || null,
        district: refRegion || null,
        town: originVillage || currentLoc || null,
        current_address: currentLoc || null,
        housing_type: shelter ? (showSchoolName && shelterName ? `${shelter} — ${shelterName}` : shelter) : null,
        family_size: Number(total) || 1,
        infants: Number(u2) || 0,
        children: Number(u12) || 0,
        elderly: hasElderly ? Number(elderlyN) || 0 : 0,
        disabled: hasDisabled,
        chronic_illness: hasChronic || critical,
        pregnant_or_nursing: pregnantOrNursing,
        displaced,
        displacement_date: displaced && dispDate ? dispDate : null,
        origin_town: originVillage || null,
        needs: needsAll,
        needs_other: otherDesc || null,
        notes: [
          notes,
          hasDisabled && disabledDesc ? `إعاقة: ${disabledDesc}` : "",
          hasChronic && chronicDesc ? `مزمن: ${chronicDesc}` : "",
          critical ? "حالة طبية حرجة" : "",
          hasPrescription ? "يوجد وصفة طبية" : "",
        ].filter(Boolean).join("\n") || null,
        submission_seconds: Math.round(elapsed),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        device_fingerprint: deviceFingerprint,
      };

      const submitResult = await submitAidRequest(payload);
      if (!submitResult.ok) {
        if (
          submitResult.reason === "phone_already_submitted" ||
          submitResult.reason === "id_already_submitted"
        ) {
          setPrecheckBlocked({
            reason: submitResult.reason,
            message: submitResult.message,
            reference_code: submitResult.reference_code,
          });
          setSubmitBlocked(true);
        }
        setSubmitError(submitResult.message);
        return;
      }
      const data = { id: submitResult.id, reference_code: submitResult.reference_code };

      setSubmitted({ code: data.reference_code, id: data.id });

      void insertSubmissionReference({
        request_id: data.id,
        reference_type: refType,
        full_name: refName.trim(),
        phone: refPhone.trim(),
        region: refRegion.trim() || null,
        village: refVillage.trim() || null,
        known_duration: refKnown || null,
        notes: refNotes.trim() || null,
      }).catch((err) => {
        if (import.meta.env.DEV) console.error("[RequestSubmit] reference insert:", err);
      });

      if (docFile) {
        void uploadIdDocument(data.id, docFile).catch((err) => {
          if (import.meta.env.DEV) console.error("[RequestSubmit] id doc upload:", err);
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setSubmitError("تعذّر إرسال الطلب — يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-background">
        <PublicNav />
        <div className="pt-24"><Success code={submitted.code} id={submitted.id} onReset={() => window.location.reload()} /></div>
        <PublicFooter />
      </main>
    );
  }

  if (acceptingSubmissions === false) {
    return (
      <main className="min-h-screen bg-background">
        <PublicNav />
        <div className="pt-24">
          <CapReachedMessage message={capMessage} />
        </div>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <PublicNav tone="dark" greenMobileMenu />

      {/* HERO — cinematic, logo-led */}
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

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32 lg:px-10">
          <div className="fade-soft flex flex-col items-center text-center">
            {/* Logo mark — full SANAD logo scaled to fit the circle */}
            <div className="relative">
              <div className="absolute inset-0 -m-3 rounded-full bg-primary/25 blur-2xl" />
              <div className="relative flex h-[5.25rem] w-[5.25rem] items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/95 p-1.5 shadow-lg sm:h-24 sm:w-24 sm:p-2">
                <img
                  src={sanadLogoPhoto}
                  alt="شعار حملة سند"
                  className="h-full w-full scale-[1.18] object-contain"
                />
              </div>
            </div>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.55em] text-white/70 sm:text-[11px]">
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
              املأ هذا الطلب بصدق وبهدوء. كل حقل تتجاوزه بأمانة يُقرّبك خطوةً من المساعدة. بياناتك محميّة، ولا تُشارَك مع أي طرفٍ ثالث.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#sec-personal" className="rounded-full bg-white px-6 py-3 text-[13px] font-medium text-ink transition hover:bg-clay hover:text-white sm:text-sm">
                ابدأ تعبئة الطلب ↓
              </a>
              <Link to="/track" className="rounded-full border border-white/30 px-5 py-3 text-[13px] text-white/90 transition hover:bg-white/10 sm:text-sm">
                تتبّع طلبٍ سابق
              </Link>
            </div>

            <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-x-4 gap-y-6 border-t border-white/15 pt-8 sm:grid-cols-4 sm:gap-x-6">
              {heroStats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-white"><Counter to={s.num} suffix={s.suffix} /></div>
                  <div className="mx-auto mt-1.5 h-px w-6 bg-clay" />
                  <div className="mt-1.5 text-[10px] uppercase tracking-wider text-white/65 sm:text-[11px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="mx-auto max-w-3xl space-y-12 px-5 py-10 sm:space-y-16 sm:px-6 sm:py-16 lg:px-10"
      >
        {/* 1 — PERSONAL */}
        <section>
          <SectionTitle id="sec-personal" n="٠١" title="المعلومات الشخصية" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-err="first">
              <Field label="الاسم الأول" required error={show("first") ? errors.first : null}>
                <input className={cls(!!(show("first") && errors.first))} placeholder="مثال: محمد" value={first} onChange={(e) => setFirst(e.target.value)} onBlur={touch("first")} />
              </Field>
            </div>
            <div data-err="father">
              <Field label="اسم الأب" required error={show("father") ? errors.father : null}>
                <input className={cls(!!(show("father") && errors.father))} placeholder="مثال: علي" value={father} onChange={(e) => setFather(e.target.value)} onBlur={touch("father")} />
              </Field>
            </div>
            <div data-err="family">
              <Field label="اسم العائلة" required error={show("family") ? errors.family : null}>
                <input className={cls(!!(show("family") && errors.family))} placeholder="مثال: الحسيني" value={family} onChange={(e) => setFamily(e.target.value)} onBlur={touch("family")} />
              </Field>
            </div>
            <div />
            <div data-err="phone">
              <Field label="رقم الهاتف الأساسي" required hint="سنتواصل معك على هذا الرقم" error={show("phone") ? errors.phone : null}>
                <input dir="ltr" inputMode="tel" autoComplete="tel" className={cls(!!(show("phone") && errors.phone))} placeholder="+961 71 234 567" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={touch("phone")} />
              </Field>
              {precheckBlocked && (
                <div className="mt-3">
                  <DuplicateSubmissionAlert
                    reason={precheckBlocked.reason}
                    message={precheckBlocked.message}
                    referenceCode={precheckBlocked.reference_code}
                  />
                </div>
              )}
            </div>
            <div data-err="phone2">
              <Field label="رقم الهاتف الثانوي" hint="اختياري" error={show("phone2") ? errors.phone2 : null}>
                <input dir="ltr" inputMode="tel" className={cls(!!(show("phone2") && errors.phone2))} placeholder="+961 70 000 000" value={phone2} onChange={(e) => setPhone2(e.target.value)} onBlur={touch("phone2")} />
              </Field>
            </div>
          </div>
        </section>

        {/* 2 — FAMILY */}
        <section>
          <SectionTitle id="sec-family" n="٠٢" title="معلومات العائلة" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div data-err="total">
              <Field label="إجمالي عدد أفراد العائلة" required error={show("total") ? errors.total : null}>
                <input type="number" min={1} inputMode="numeric" placeholder="مثال: 5" className={cls(!!(show("total") && errors.total))} value={total} onChange={(e) => setTotal(e.target.value)} onBlur={touch("total")} />
              </Field>
            </div>
            <div data-err="u12">
              <Field label="أطفال تحت ١٢ سنة" required error={show("u12") ? errors.u12 : null}>
                <input type="number" min={0} inputMode="numeric" placeholder="مثال: 2" className={cls(!!(show("u12") && errors.u12))} value={u12} onChange={(e) => setU12(e.target.value)} onBlur={touch("u12")} />
              </Field>
            </div>
            <div data-err="u2">
              <Field label="رضّع تحت سنتين" required error={show("u2") ? errors.u2 : null}>
                <input type="number" min={0} inputMode="numeric" placeholder="مثال: 1" className={cls(!!(show("u2") && errors.u2))} value={u2} onChange={(e) => setU2(e.target.value)} onBlur={touch("u2")} />
              </Field>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:mt-6">
            <Toggle on={hasElderly} onChange={setHasElderly} label="يوجد كبار في السن" />
            {hasElderly && (
              <div data-err="elderlyN">
                <Field label="كم عدد كبار السن؟" required error={show("elderlyN") ? errors.elderlyN : null}>
                  <input type="number" min={1} inputMode="numeric" placeholder="مثال: 1" className={cls(!!(show("elderlyN") && errors.elderlyN))} value={elderlyN} onChange={(e) => setElderlyN(e.target.value)} onBlur={touch("elderlyN")} />
                </Field>
              </div>
            )}
            <Toggle on={hasDisabled} onChange={setHasDisabled} label="يوجد شخص من ذوي الاحتياجات الخاصة" />
            {hasDisabled && (
              <div data-err="disabledDesc">
                <Field label="يرجى توضيح نوع الإعاقة" required hint="شلل دماغي، إعاقة حركية، فقدان بصر..." error={show("disabledDesc") ? errors.disabledDesc : null}>
                  <textarea rows={2} placeholder="مثال: إعاقة حركية في الطرف السفلي" className={cls(!!(show("disabledDesc") && errors.disabledDesc))} value={disabledDesc} onChange={(e) => setDisabledDesc(e.target.value)} onBlur={touch("disabledDesc")} />
                </Field>
              </div>
            )}
            <Toggle on={hasChronic} onChange={setHasChronic} label="يوجد مصاب بمرض مزمن" />
            {hasChronic && (
              <div data-err="chronicDesc">
                <Field label="يرجى ذكر المرض" required hint="سرطان، سكري، غسيل كلى، أمراض قلبية..." error={show("chronicDesc") ? errors.chronicDesc : null}>
                  <textarea rows={2} placeholder="مثال: سكري من النوع الأول" className={cls(!!(show("chronicDesc") && errors.chronicDesc))} value={chronicDesc} onChange={(e) => setChronicDesc(e.target.value)} onBlur={touch("chronicDesc")} />
                </Field>
              </div>
            )}
            <Toggle on={pregnantOrNursing} onChange={setPregnantOrNursing} label="يوجد حامل أو مرضع في العائلة" />
          </div>
        </section>

        {/* 3 — DISPLACEMENT */}
        <section>
          <SectionTitle id="sec-disp" n="٠٣" title="معلومات النزوح" />
          <Toggle on={displaced} onChange={setDisplaced} label="هل أنت نازح/ة؟" />
          {displaced && (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div data-err="origin">
                <Field label="منطقة المنشأ" required error={show("origin") ? errors.origin : null}>
                  <select className={cls(!!(show("origin") && errors.origin))} value={origin} onChange={(e) => setOrigin(e.target.value)} onBlur={touch("origin")}>
                    <option value="">اختر المنطقة</option>
                    {REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
              <div data-err="originVillage">
                <Field label="قرية أو بلدة المنشأ" required error={show("originVillage") ? errors.originVillage : null}>
                  <input placeholder="مثال: عيترون" className={cls(!!(show("originVillage") && errors.originVillage))} value={originVillage} onChange={(e) => setOriginVillage(e.target.value)} onBlur={touch("originVillage")} />
                </Field>
              </div>
              <div data-err="currentLoc">
                <Field label="موقعك الحالي" required hint="مثال: بيروت، صيدا، الجية" error={show("currentLoc") ? errors.currentLoc : null}>
                  <input placeholder="مثال: بيروت — برج البراجنة" className={cls(!!(show("currentLoc") && errors.currentLoc))} value={currentLoc} onChange={(e) => setCurrentLoc(e.target.value)} onBlur={touch("currentLoc")} />
                </Field>
              </div>
              <div data-err="shelter">
                <Field label="نوع المأوى الحالي" required error={show("shelter") ? errors.shelter : null}>
                  <select className={cls(!!(show("shelter") && errors.shelter))} value={shelter} onChange={(e) => setShelter(e.target.value)} onBlur={touch("shelter")}>
                    <option value="">اختر</option>
                    {SHELTERS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              {showSchoolName && (
                <div data-err="shelterName">
                  <Field label="اسم المدرسة أو المأوى" required error={show("shelterName") ? errors.shelterName : null}>
                    <input placeholder="مثال: مدرسة الإمام الحسن" className={cls(!!(show("shelterName") && errors.shelterName))} value={shelterName} onChange={(e) => setShelterName(e.target.value)} onBlur={touch("shelterName")} />
                  </Field>
                </div>
              )}
              <div data-err="dispDate">
                <Field label="تاريخ النزوح" required error={show("dispDate") ? errors.dispDate : null}>
                  <input type="date" max={new Date().toISOString().split("T")[0]} className={cls(!!(show("dispDate") && errors.dispDate))} value={dispDate} onChange={(e) => setDispDate(e.target.value)} onBlur={touch("dispDate")} />
                </Field>
              </div>
              {dispDate && monthsAgo(dispDate) > 6 && (
                <div className="md:col-span-2"><Warn>مرّ أكثر من ٦ أشهر على هذا التاريخ — يرجى التأكد من صحته.</Warn></div>
              )}
            </div>
          )}
        </section>

        {/* 4 — NEEDS */}
        <section>
          <SectionTitle id="sec-needs" n="٠٤" title="الاحتياجات" sub="اختر حاجة واحدة على الأقل" />
          <div data-err="needs" className="flex flex-wrap gap-2">
            {NEEDS.map((n) => <Chip key={n} on={hasNeed(n)} onClick={() => toggleNeed(n)}>{n}</Chip>)}
          </div>
          {show("needs") && errors.needs && <div className="mt-2 text-xs text-destructive">{errors.needs}</div>}

          {hasNeed("حفاضات") && (
            <div className="mt-5 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="mb-3 text-sm font-medium">تفاصيل الحفاضات</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div data-err="diaperSize">
                  <Field label="القياس" required error={show("diaperSize") ? errors.diaperSize : null}>
                    <select className={cls(!!(show("diaperSize") && errors.diaperSize))} value={diaperSize} onChange={(e) => setDiaperSize(e.target.value)} onBlur={touch("diaperSize")}>
                      <option value="">اختر القياس</option>
                      {DIAPER_SIZES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <div data-err="infantAge">
                  <Field label="عمر الرضيع (بالأشهر)" required error={show("infantAge") ? errors.infantAge : null}>
                    <input type="number" min={0} max={36} placeholder="مثال: 8" className={cls(!!(show("infantAge") && errors.infantAge))} value={infantAge} onChange={(e) => setInfantAge(e.target.value)} onBlur={touch("infantAge")} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {hasNeed("حليب أطفال") && (
            <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="mb-3 text-sm font-medium">تفاصيل الحليب</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div data-err="milkBrand">
                  <Field label="الماركة" required error={show("milkBrand") ? errors.milkBrand : null}>
                    <select className={cls(!!(show("milkBrand") && errors.milkBrand))} value={milkBrand} onChange={(e) => setMilkBrand(e.target.value)} onBlur={touch("milkBrand")}>
                      <option value="">اختر الماركة</option>
                      {MILK_BRANDS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <div data-err="milkStage">
                  <Field label="المرحلة" required error={show("milkStage") ? errors.milkStage : null}>
                    <select className={cls(!!(show("milkStage") && errors.milkStage))} value={milkStage} onChange={(e) => setMilkStage(e.target.value)} onBlur={touch("milkStage")}>
                      <option value="">اختر المرحلة</option>
                      {MILK_STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <div data-err="milkAge">
                  <Field label="عمر الرضيع (بالأشهر)" required error={show("milkAge") ? errors.milkAge : null}>
                    <input type="number" min={0} max={36} placeholder="مثال: 4" className={cls(!!(show("milkAge") && errors.milkAge))} value={milkAge} onChange={(e) => setMilkAge(e.target.value)} onBlur={touch("milkAge")} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {hasNeed("أدوية") && (
            <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="mb-3 text-sm font-medium">تفاصيل الأدوية</div>
              <div data-err="meds">
                <Field label="قائمة الأدوية المطلوبة" required hint="اذكر اسم الدواء والجرعة — مثال: أنسولين ٣٠ وحدة" error={show("meds") ? errors.meds : null}>
                  <textarea rows={3} placeholder="مثال: أنسولين ٣٠ وحدة يومياً، ميتفورمين ٥٠٠ مغ" className={cls(!!(show("meds") && errors.meds))} value={meds} onChange={(e) => setMeds(e.target.value)} onBlur={touch("meds")} />
                </Field>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <Toggle on={hasPrescription} onChange={setHasPrescription} label="يوجد وصفة طبية" />
                <Toggle on={critical} onChange={setCritical} label="دواء لحالة حرجة (أنسولين، غسيل كلى، علاج سرطان، مضاد صرع)" />
              </div>
              {critical && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-destructive sm:text-sm">
                  تم تحديد الطلب كحالة طبية حرجة — سيُعطى أولوية فورية في المراجعة.
                </div>
              )}
            </div>
          )}

          {hasNeed("مساعدة مالية") && (
            <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div data-err="finPurpose">
                <Field label="الغرض من المساعدة المالية" required error={show("finPurpose") ? errors.finPurpose : null}>
                  <select className={cls(!!(show("finPurpose") && errors.finPurpose))} value={finPurpose} onChange={(e) => setFinPurpose(e.target.value)} onBlur={touch("finPurpose")}>
                    <option value="">اختر الغرض</option>
                    {FIN_PURPOSE.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {hasNeed("ملابس") && (
            <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div data-err="clothesDesc">
                <Field label="تفاصيل الملابس المطلوبة" required hint="اذكر المقاسات والأعمار والجنس" error={show("clothesDesc") ? errors.clothesDesc : null}>
                  <textarea rows={3} placeholder="مثال: ولد ٧ سنوات — مقاس متوسط، بنت ٣ سنوات — مقاس صغير" className={cls(!!(show("clothesDesc") && errors.clothesDesc))} value={clothesDesc} onChange={(e) => setClothesDesc(e.target.value)} onBlur={touch("clothesDesc")} />
                </Field>
              </div>
            </div>
          )}

          {hasNeed("أخرى") && (
            <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div data-err="otherDesc">
                <Field label="وصف الحاجة" required error={show("otherDesc") ? errors.otherDesc : null}>
                  <textarea rows={3} placeholder="اشرح الحاجة بالتفصيل" className={cls(!!(show("otherDesc") && errors.otherDesc))} value={otherDesc} onChange={(e) => setOtherDesc(e.target.value)} onBlur={touch("otherDesc")} />
                </Field>
              </div>
            </div>
          )}

          <div className="mt-5 sm:mt-6">
            <Field label="ملاحظات عامة" hint="أي معلومات إضافية تريد إيصالها لفريقنا">
              <textarea rows={3} placeholder="اختياري — أضف أي تفاصيل تساعدنا في فهم حالتك" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {warnings.map((w, i) => <Warn key={i}>{w}</Warn>)}
            </div>
          )}
        </section>

        {/* 5 — REFERENCE */}
        <section>
          <SectionTitle id="sec-ref" n="٠٥" title="المرجع" sub="يرجى ذكر شخص موثوق من منطقتك يمكننا التواصل معه للتحقق من هويتك وأوضاعك" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-err="refType">
              <Field label="نوع المرجع" required error={show("refType") ? errors.refType : null}>
                <select className={cls(!!(show("refType") && errors.refType))} value={refType} onChange={(e) => setRefType(e.target.value)} onBlur={touch("refType")}>
                  <option value="">اختر</option>{REF_TYPES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div data-err="refName">
              <Field label="الاسم الكامل للمرجع" required error={show("refName") ? errors.refName : null}>
                <input placeholder="مثال: الشيخ حسن قبلان" className={cls(!!(show("refName") && errors.refName))} value={refName} onChange={(e) => setRefName(e.target.value)} onBlur={touch("refName")} />
              </Field>
            </div>
            <div data-err="refPhone">
              <Field label="رقم هاتف المرجع" required error={show("refPhone") ? errors.refPhone : null}>
                <input dir="ltr" inputMode="tel" placeholder="+961 70 000 000" className={cls(!!(show("refPhone") && errors.refPhone))} value={refPhone} onChange={(e) => setRefPhone(e.target.value)} onBlur={touch("refPhone")} />
              </Field>
            </div>
            <div data-err="refRegion">
              <Field label="منطقة المرجع" required error={show("refRegion") ? errors.refRegion : null}>
                <input placeholder="مثال: قضاء بنت جبيل" className={cls(!!(show("refRegion") && errors.refRegion))} value={refRegion} onChange={(e) => setRefRegion(e.target.value)} onBlur={touch("refRegion")} />
              </Field>
            </div>
            <Field label="قرية المرجع" hint="اختياري">
              <input placeholder="مثال: عيترون" className={inputCls} value={refVillage} onChange={(e) => setRefVillage(e.target.value)} />
            </Field>
            <div data-err="refKnown">
              <Field label="منذ متى تعرفه؟" required error={show("refKnown") ? errors.refKnown : null}>
                <select className={cls(!!(show("refKnown") && errors.refKnown))} value={refKnown} onChange={(e) => setRefKnown(e.target.value)} onBlur={touch("refKnown")}>
                  <option value="">اختر</option>{KNOWN.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="ملاحظات إضافية حول المرجع" hint="اختياري">
                <textarea rows={2} placeholder="أي معلومات تساعدنا في التواصل" className={inputCls} value={refNotes} onChange={(e) => setRefNotes(e.target.value)} />
              </Field>
            </div>
          </div>
        </section>

        {/* 6 — DOCUMENT */}
        <section>
          <SectionTitle id="sec-doc" n="٠٦" title="وثيقة الهوية" sub="بياناتك محميّة ومشفّرة ولن تُشارَك مع أي جهة خارجية." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-err="docType">
              <Field label="نوع الوثيقة" required error={show("docType") ? errors.docType : null}>
                <select className={cls(!!(show("docType") && errors.docType))} value={docType} onChange={(e) => setDocType(e.target.value)} onBlur={touch("docType")}>
                  <option value="">اختر</option>{DOC_TYPES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div data-err="docNumber">
              <Field label="رقم الوثيقة" required error={show("docNumber") ? errors.docNumber : null}>
                <input placeholder="مثال: 12345678" className={cls(!!(show("docNumber") && errors.docNumber))} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} onBlur={touch("docNumber")} />
              </Field>
            </div>
            <Field label="تاريخ انتهاء الوثيقة" hint="اختياري">
              <input type="date" className={inputCls} value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
            </Field>
            <div />
            <div className="md:col-span-2" data-err="docFile">
              <Field label="رفع صورة الوثيقة" hint="JPG, PNG, PDF — حد أقصى ٥ ميغابايت" required error={(show("docFile") && errors.docFile) || docError}>
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-7 text-[13px] text-muted-foreground hover:border-clay sm:py-8 sm:text-sm">
                  <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] ?? null); touch("docFile")(); }} />
                  {docFile ? <span className="text-foreground">{docFile.name} — {(docFile.size / 1024).toFixed(0)} KB</span> : "اضغط لاختيار ملف من جهازك"}
                </label>
              </Field>
              {docFile && !docError && (
                <div className="mt-3 flex items-center gap-2 text-xs text-success">
                  <span>✓ تم رفع الملف بنجاح</span>
                  <button type="button" onClick={() => onFile(null)} className="text-muted-foreground underline hover:text-foreground">استبدال</button>
                </div>
              )}
              {docPreview && (
                <div className="mt-3 overflow-hidden rounded-md border border-border">
                  <img src={docPreview} alt="معاينة الوثيقة" className="max-h-56 w-full object-contain bg-surface" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 7 — REVIEW */}
        <section>
          <SectionTitle id="sec-review" n="٠٧" title="مراجعة وتأكيد" />
          <div className="space-y-3 rounded-xl border border-border bg-surface p-5 text-[13px] sm:text-sm">
            {[
              { l: "المعلومات الشخصية", v: [first, father, family].filter(Boolean).join(" ") || "—", anchor: "sec-personal", phone },
              { l: "العائلة", v: `${total || 0} فرد${u2 ? ` — ${u2} رضيع` : ""}`, anchor: "sec-family" },
              { l: "النزوح", v: displaced ? `${origin || "—"} → ${currentLoc || "—"}${shelter ? ` (${shelter})` : ""}` : "غير نازح", anchor: "sec-disp" },
              { l: "الاحتياجات", v: needs.length ? needs.join("، ") : "—", anchor: "sec-needs" },
              { l: "المرجع", v: refName ? `${refName} (${refType})` : "—", anchor: "sec-ref" },
              { l: "الوثيقة", v: docType || "—", anchor: "sec-doc" },
            ].map((r) => (
              <div key={r.l} className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.l}</div>
                  <div className="mt-0.5 break-words text-foreground">{r.v}</div>
                </div>
                <a href={`#${r.anchor}`} className="shrink-0 text-[11px] text-clay underline-offset-2 hover:underline">تعديل</a>
              </div>
            ))}
          </div>

          {!isValid && attempted && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive sm:text-sm">
              يرجى التحقق من الحقول المظللة بالأحمر قبل الإرسال.
            </div>
          )}

          <label className="mt-5 flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-[13px] sm:text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-clay)]" />
            <span>أؤكد أن جميع المعلومات المقدمة صحيحة ودقيقة، وأن طلبي مشروع وحقيقي.</span>
          </label>

          {submitError && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={!confirmed || submitting || submitBlocked}
            className="mt-5 w-full rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "جارٍ الإرسال..." : "تقديم الطلب"}
          </button>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            بالضغط على "تقديم الطلب" فإنك توافق على معالجة بياناتك ضمن سياسة الخصوصية الخاصة بسند.
          </p>
        </section>
      </form>

      <PublicFooter />
    </main>
  );
}
