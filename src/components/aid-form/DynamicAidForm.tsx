import { useEffect, useRef, useState } from "react";
import type { AidFormField, AidFormSchema } from "@/lib/aid-form-schema";
import {
  getAidFormWarnings,
  initAidFormValues,
  isAidFormFieldVisible,
  phoneFieldId,
  AID_FORM_LEVEL_ERROR_KEY,
  validateAidFormValues,
  type AidFormValues,
} from "@/lib/aid-form-validation";
import {
  buildAidFormSubmitPayload,
  buildReviewSummary,
} from "@/lib/aid-form-payload";
import { submitAidRequest } from "@/lib/submit-aid-request";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { precheckAidSubmission } from "@/lib/precheck-aid-submission";
import { isLebanesePhone } from "@/lib/phone-normalize";
import { DuplicateSubmissionAlert } from "@/components/DuplicateSubmissionAlert";
import { findFieldByBinding } from "@/lib/aid-form-validation";

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
  label,
  children,
  hint,
  required,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <span className="text-[13px] text-foreground sm:text-sm">
          {label} {required && <span className="text-clay">*</span>}
        </span>
        {hint && !error && <span className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">{hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1 text-[11px] text-destructive sm:text-xs">{error}</div>}
    </label>
  );
}

function Toggle({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 text-[14px] hover:border-foreground/30 sm:text-sm"
      aria-pressed={on}
    >
      <span className="min-w-0 flex-1 text-right leading-snug">
        {label}
        {sub && <span className="mt-0.5 block text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <span className={["relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-clay" : "bg-muted"].join(" ")}>
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
        "min-h-10 rounded-full border px-3.5 py-2 text-[13px] transition sm:px-4 sm:py-2 sm:text-sm",
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

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

type DynamicAidFormProps = {
  schema: AidFormSchema;
  startedAt: number;
  onSuccess: (result: { code: string; id: string }) => void;
};

export function DynamicAidForm({ schema, startedAt, onSuccess }: DynamicAidFormProps) {
  const [values, setValues] = useState<AidFormValues>(() => initAidFormValues(schema));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [precheckBlocked, setPrecheckBlocked] = useState<{
    message: string;
    reference_code?: string | null;
  } | null>(null);
  const [submitBlocked, setSubmitBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setValues(initAidFormValues(schema));
    setTouched({});
    setAttempted(false);
  }, [schema]);

  const touch = (k: string) => () => setTouched((p) => ({ ...p, [k]: true }));
  const show = (k: string) => attempted || touched[k];
  const setVal = (fieldId: string, v: unknown) => setValues((p) => ({ ...p, [fieldId]: v }));

  const errors = validateAidFormValues(schema, values);
  const formLevelError = errors[AID_FORM_LEVEL_ERROR_KEY] ?? null;
  const isValid = Object.keys(errors).length === 0;
  const warnings = getAidFormWarnings(schema, values);
  const reviewRows = buildReviewSummary(schema, values);
  const confirmField = findFieldByBinding(schema, "confirm");
  const confirmed = confirmField ? values[confirmField.id] === true : true;

  const phoneId = phoneFieldId(schema);
  const phone = phoneId ? str(values[phoneId]) : "";

  useEffect(() => {
    if (!phone.trim() || !isLebanesePhone(phone)) {
      setPrecheckBlocked(null);
      setSubmitBlocked(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void precheckAidSubmission({ phone: phone.trim() }).then((result) => {
        if (!result.ok) return;
        if (!result.allowed) {
          if (result.reason === "phone_already_submitted") {
            setPrecheckBlocked({ message: result.message });
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
    }, 500);

    return () => window.clearTimeout(timer);
  }, [phone]);

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

    const elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed < 90 && !confirm("يرجى مراجعة إجاباتك قبل الإرسال — هل أنت متأكد من صحة جميع المعلومات؟")) {
      return;
    }

    setSubmitting(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const { payload } = buildAidFormSubmitPayload(schema, values, {
        submission_seconds: Math.round(elapsed),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        device_fingerprint: deviceFingerprint,
      });

      const submitResult = await submitAidRequest(payload);
      if (!submitResult.ok) {
        if (submitResult.reason === "phone_already_submitted") {
          setPrecheckBlocked({
            message: submitResult.message,
            reference_code: submitResult.reference_code,
          });
          setSubmitBlocked(true);
        }
        setSubmitError(submitResult.message);
        return;
      }

      onSuccess({ code: submitResult.reference_code, id: submitResult.id });
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setSubmitError("تعذّر إرسال الطلب — يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: AidFormField) => {
    if (!isAidFormFieldVisible(field, values, schema)) return null;

    const err = show(field.id) ? errors[field.id] : null;
    const raw = values[field.id];
    const isPhonePrimary = field.binding === "phone";

    if (field.type === "toggle") {
      return (
        <div key={field.id} data-err={field.id}>
          <Toggle on={raw === true} onChange={(v) => setVal(field.id, v)} label={field.label} />
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <div key={field.id} data-err={field.id} className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={raw === true}
            onChange={(e) => setVal(field.id, e.target.checked)}
            onBlur={touch(field.id)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <label className="text-[13px] leading-relaxed sm:text-sm">
            {field.label} {field.required && <span className="text-clay">*</span>}
          </label>
          {err && <div className="mt-1 text-xs text-destructive">{err}</div>}
        </div>
      );
    }

    if (field.type === "multiselect") {
      const selected = strArr(raw);
      const toggle = (opt: string) => {
        setVal(
          field.id,
          selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt],
        );
      };
      return (
        <div key={field.id} data-err={field.id}>
          <Field label={field.label} required={field.required} hint={field.hint} error={err}>
            <div className="flex flex-wrap gap-2">
              {(field.options ?? []).map((opt) => (
                <Chip key={opt} on={selected.includes(opt)} onClick={() => toggle(opt)}>
                  {opt}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      );
    }

    const input =
      field.type === "textarea" ? (
        <textarea
          rows={3}
          placeholder={field.placeholder}
          className={cls(!!err)}
          value={str(raw)}
          onChange={(e) => setVal(field.id, e.target.value)}
          onBlur={touch(field.id)}
        />
      ) : field.type === "select" ? (
        <select
          className={cls(!!err)}
          value={str(raw)}
          onChange={(e) => setVal(field.id, e.target.value)}
          onBlur={touch(field.id)}
        >
          <option value="">اختر</option>
          {(field.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          dir={field.type === "tel" ? "ltr" : undefined}
          inputMode={field.type === "tel" ? "tel" : field.type === "number" ? "numeric" : undefined}
          autoComplete={field.type === "tel" && isPhonePrimary ? "tel" : undefined}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          className={cls(!!err)}
          value={str(raw)}
          onChange={(e) => setVal(field.id, e.target.value)}
          onBlur={touch(field.id)}
          {...(field.type === "date" ? { max: new Date().toISOString().split("T")[0] } : {})}
        />
      );

    const fieldNode = (
      <div key={field.id} data-err={field.id}>
        <Field label={field.label} required={field.required} hint={field.hint} error={err}>
          {input}
        </Field>
        {isPhonePrimary && precheckBlocked && (
          <div className="mt-3">
            <DuplicateSubmissionAlert
              message={precheckBlocked.message}
              referenceCode={precheckBlocked.reference_code}
            />
          </div>
        )}
      </div>
    );

    if (field.parent_option) {
      return (
        <div key={field.id} className="md:col-span-2">
          {fieldNode}
        </div>
      );
    }

    return fieldNode;
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto max-w-3xl space-y-12 px-4 py-10 sm:space-y-16 sm:px-6 sm:py-16 lg:px-10"
    >
      {schema.sections.map((section) => {
        if (section.id === "review") {
          return (
            <section key={section.id}>
              <SectionTitle
                id={`sec-${section.id}`}
                n={section.number_label}
                title={section.title}
                sub={section.subtitle}
              />
              <div className="space-y-3 rounded-xl border border-border bg-surface p-5 text-[13px] sm:text-sm">
                {reviewRows.map((r) => (
                  <div key={r.label} className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                      <div className="mt-0.5 break-words text-foreground">{r.value}</div>
                    </div>
                    <a href={`#${r.anchor}`} className="shrink-0 text-[11px] text-clay underline-offset-2 hover:underline">
                      تعديل
                    </a>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {section.fields.map((f) => renderField(f))}
              </div>
            </section>
          );
        }

        const visibleFields = section.fields.filter((f) => isAidFormFieldVisible(f, values, schema));
        const parentFields = section.fields.filter((f) => !f.parent_option);
        const subFields = section.fields.filter((f) => f.parent_option);

        const subGroups = new Map<string, AidFormField[]>();
        for (const f of subFields) {
          if (!f.parent_option || !isAidFormFieldVisible(f, values, schema)) continue;
          const list = subGroups.get(f.parent_option) ?? [];
          list.push(f);
          subGroups.set(f.parent_option, list);
        }

        return (
          <section key={section.id}>
            <SectionTitle
              id={`sec-${section.id}`}
              n={section.number_label}
              title={section.title}
              sub={section.subtitle}
            />
            <div
              className={
                section.id === "needs"
                  ? "space-y-4"
                  : "grid grid-cols-1 gap-4 md:grid-cols-2"
              }
            >
              {parentFields.map((f) => renderField(f))}
            </div>
            {[...subGroups.entries()].map(([opt, fields]) => (
              <div key={opt} className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <div className="mb-3 text-sm font-medium">تفاصيل {opt}</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {fields.map((f) => renderField(f))}
                </div>
              </div>
            ))}
            {section.id === "needs" && warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {warnings.map((w, i) => (
                  <Warn key={i}>{w}</Warn>
                ))}
              </div>
            )}
            {visibleFields.length === 0 && section.fields.length > 0 && section.id !== "needs" && (
              <p className="text-sm text-muted-foreground">لا توجد حقول ظاهرة في هذا القسم.</p>
            )}
          </section>
        );
      })}

      {show(AID_FORM_LEVEL_ERROR_KEY) && formLevelError && (
        <div
          data-err={AID_FORM_LEVEL_ERROR_KEY}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {formLevelError}
        </div>
      )}

      {submitError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <button
          type="submit"
          disabled={submitting || submitBlocked || !confirmed}
          className="touch-target rounded-full bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
        </button>
      </div>
    </form>
  );
}
