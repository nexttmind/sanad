import { useState, type ReactNode } from "react";
import { Loader2, Pencil, X, Check } from "lucide-react";
import {
  GOVERNORATE_OPTIONS,
  NEED_OPTIONS,
  SHELTER_OPTIONS,
} from "@/lib/request-form-constants";
import type { AidRowExtended } from "@/lib/request-detail-types";
import {
  requestToEditableFields,
  updateRequestFields,
  type EditableRequestFields,
} from "@/lib/request-field-edit";

type SectionKey = "personal" | "family" | "location" | "needs";

type Props = {
  request: AidRowExtended;
  requestId: string;
  actorName: string;
  onSaved: () => void | Promise<void>;
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function EditRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid grid-cols-[10rem_1fr] gap-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
      <span className="pt-2 text-muted-foreground">{label}</span>
      <div>
        {children}
        {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
      </div>
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-clay focus:outline-none focus:ring-1 focus:ring-clay/30";

function SectionCard({
  title,
  editing,
  busy,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="font-display text-base">{title}</div>
        <div className="flex gap-1">
          {!editing ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:border-foreground/40"
            >
              <Pencil className="h-3 w-3" />
              تعديل
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onSave}
                className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[11px] text-success hover:bg-success/20 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                حفظ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:border-foreground/40 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                إلغاء
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function EditableRequestSections({ request, requestId, actorName, onSaved }: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState<EditableRequestFields>(() => requestToEditableFields(request));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const startEdit = (section: SectionKey) => {
    setDraft(requestToEditableFields(request));
    setErrors({});
    setMessage(null);
    setActiveSection(section);
  };

  const cancelEdit = () => {
    setActiveSection(null);
    setDraft(requestToEditableFields(request));
    setErrors({});
    setMessage(null);
  };

  const saveSection = async (section: SectionKey) => {
    setBusy(true);
    setMessage(null);
    const result = await updateRequestFields({
      requestId,
      referenceCode: request.reference_code,
      before: request,
      after: draft,
      section,
      actorName,
    });
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setActiveSection(null);
    setMessage("تم حفظ التعديلات — سيتم إعادة احتساب العجلة تلقائياً.");
    await onSaved();
    setBusy(false);
  };

  const patch = (partial: Partial<EditableRequestFields>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const toggleNeed = (need: string) => {
    setDraft((prev) => ({
      ...prev,
      needs: prev.needs.includes(need)
        ? prev.needs.filter((n) => n !== need)
        : [...prev.needs, need],
    }));
  };

  return (
    <>
      {message && (
        <p className="rounded-md border border-clay/30 bg-clay/5 px-3 py-2 text-xs text-clay">{message}</p>
      )}

      <SectionCard
        title="المعلومات الشخصية"
        editing={activeSection === "personal"}
        busy={busy}
        onEdit={() => startEdit("personal")}
        onCancel={cancelEdit}
        onSave={() => void saveSection("personal")}
      >
        {activeSection === "personal" ? (
          <>
            <Row label="الاسم الكامل" value={request.full_name} />
            <EditRow label="الهاتف الأساسي" error={errors.phone}>
              <input
                dir="ltr"
                className={inputCls}
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </EditRow>
            <EditRow label="هاتف بديل" error={errors.alt_phone}>
              <input
                dir="ltr"
                className={inputCls}
                value={draft.alt_phone}
                onChange={(e) => patch({ alt_phone: e.target.value })}
                placeholder="اختياري"
              />
            </EditRow>
          </>
        ) : (
          <>
            <Row label="الاسم الكامل" value={request.full_name} />
            <Row
              label="الهاتف الأساسي"
              value={<span dir="ltr" className="font-mono">{request.phone}</span>}
            />
            <Row
              label="هاتف بديل"
              value={
                request.alt_phone ? (
                  <span dir="ltr" className="font-mono">{request.alt_phone}</span>
                ) : (
                  "—"
                )
              }
            />
          </>
        )}
        <Row
          label="تأكيد OTP"
          value={
            request.phone_verified ? (
              <span className="text-success">تم</span>
            ) : (
              <span className="text-warning">لم يتم</span>
            )
          }
        />
        {(request.status === "approved" || request.status === "distributed") && request.qr_pin && (
          <Row
            label="رمز التوزيع (PIN)"
            value={
              <span dir="ltr" className="font-mono text-clay">
                {request.qr_pin}
              </span>
            }
          />
        )}
        <Row label="الهوية الوطنية" value={request.national_id ?? "—"} />
      </SectionCard>

      <SectionCard
        title="تركيبة العائلة"
        editing={activeSection === "family"}
        busy={busy}
        onEdit={() => startEdit("family")}
        onCancel={cancelEdit}
        onSave={() => void saveSection("family")}
      >
        {activeSection === "family" ? (
          <>
            <EditRow label="إجمالي الأفراد" error={errors.family_size}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={draft.family_size}
                onChange={(e) => patch({ family_size: Math.max(1, Number(e.target.value) || 1) })}
              />
            </EditRow>
            <EditRow label="رضّع" error={errors.infants}>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={draft.infants}
                onChange={(e) => patch({ infants: Math.max(0, Number(e.target.value) || 0) })}
              />
            </EditRow>
            <EditRow label="أطفال" error={errors.children}>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={draft.children}
                onChange={(e) => patch({ children: Math.max(0, Number(e.target.value) || 0) })}
              />
            </EditRow>
            <EditRow label="كبار سن" error={errors.elderly}>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={draft.elderly}
                onChange={(e) => patch({ elderly: Math.max(0, Number(e.target.value) || 0) })}
              />
            </EditRow>
            <EditRow label="ذوو إعاقة">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.disabled}
                  onChange={(e) => patch({ disabled: e.target.checked })}
                />
                نعم
              </label>
            </EditRow>
            <EditRow label="مرض مزمن">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.chronic_illness}
                  onChange={(e) => patch({ chronic_illness: e.target.checked })}
                />
                نعم
              </label>
            </EditRow>
            <EditRow label="حامل/مرضع">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.pregnant_or_nursing}
                  onChange={(e) => patch({ pregnant_or_nursing: e.target.checked })}
                />
                نعم
              </label>
            </EditRow>
          </>
        ) : (
          <>
            <Row label="إجمالي الأفراد" value={request.family_size} />
            <Row label="رضّع" value={request.infants} />
            <Row label="أطفال" value={request.children} />
            <Row label="كبار سن" value={request.elderly} />
            <Row label="ذوو إعاقة" value={request.disabled ? "نعم" : "لا"} />
            <Row label="مرض مزمن" value={request.chronic_illness ? "نعم" : "لا"} />
            <Row label="حامل/مرضع" value={request.pregnant_or_nursing ? "نعم" : "لا"} />
          </>
        )}
      </SectionCard>

      <SectionCard
        title="الموقع والنزوح"
        editing={activeSection === "location"}
        busy={busy}
        onCancel={cancelEdit}
        onEdit={() => startEdit("location")}
        onSave={() => void saveSection("location")}
      >
        {activeSection === "location" ? (
          <>
            <EditRow label="المحافظة">
              <select
                className={inputCls}
                value={draft.governorate}
                onChange={(e) => patch({ governorate: e.target.value })}
              >
                <option value="">—</option>
                {GOVERNORATE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </EditRow>
            <EditRow label="البلدة">
              <input
                className={inputCls}
                value={draft.town}
                onChange={(e) => patch({ town: e.target.value })}
              />
            </EditRow>
            <EditRow label="العنوان الحالي">
              <input
                className={inputCls}
                value={draft.current_address}
                onChange={(e) => patch({ current_address: e.target.value })}
              />
            </EditRow>
            <EditRow label="نوع المأوى">
              <select
                className={inputCls}
                value={draft.housing_type}
                onChange={(e) => patch({ housing_type: e.target.value })}
              >
                <option value="">—</option>
                {SHELTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </EditRow>
            <EditRow label="نازح">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.displaced}
                  onChange={(e) => patch({ displaced: e.target.checked })}
                />
                نعم
              </label>
            </EditRow>
            <EditRow label="بلدة المنشأ">
              <input
                className={inputCls}
                value={draft.origin_town}
                onChange={(e) => patch({ origin_town: e.target.value })}
              />
            </EditRow>
            <EditRow label="تاريخ النزوح" error={errors.displacement_date}>
              <input
                type="date"
                max={new Date().toISOString().split("T")[0]}
                className={inputCls}
                value={draft.displacement_date}
                onChange={(e) => patch({ displacement_date: e.target.value })}
                disabled={!draft.displaced}
              />
            </EditRow>
          </>
        ) : (
          <>
            <Row label="المحافظة" value={request.governorate} />
            <Row label="القضاء" value={request.district} />
            <Row label="البلدة" value={request.town} />
            <Row label="العنوان الحالي" value={request.current_address} />
            <Row label="نوع المأوى" value={request.housing_type} />
            <Row label="نازح" value={request.displaced ? "نعم" : "لا"} />
            <Row label="بلدة المنشأ" value={request.origin_town} />
            <Row label="تاريخ النزوح" value={request.displacement_date} />
          </>
        )}
      </SectionCard>

      <SectionCard
        title="الاحتياجات"
        editing={activeSection === "needs"}
        busy={busy}
        onCancel={cancelEdit}
        onEdit={() => startEdit("needs")}
        onSave={() => void saveSection("needs")}
      >
        {activeSection === "needs" ? (
          <>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">اختر حاجة واحدة على الأقل</div>
              <div className="flex flex-wrap gap-2">
                {NEED_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNeed(n)}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition",
                      draft.needs.includes(n)
                        ? "border-clay bg-clay/10 text-clay"
                        : "border-border hover:border-foreground/40",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {errors.needs && <p className="text-[11px] text-destructive">{errors.needs}</p>}
            </div>
            <EditRow label="تفاصيل أخرى" error={errors.needs_other}>
              <textarea
                rows={2}
                className={inputCls}
                value={draft.needs_other}
                onChange={(e) => patch({ needs_other: e.target.value })}
              />
            </EditRow>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {request.needs.length === 0 && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              {request.needs.map((n) => (
                <span key={n} className="rounded-full border border-border bg-background px-3 py-1 text-xs">
                  {n}
                </span>
              ))}
            </div>
            {request.needs_other && (
              <div className="mt-3 text-sm text-muted-foreground">{request.needs_other}</div>
            )}
          </>
        )}
        {request.notes && (
          <div className="mt-3 rounded-md border border-border bg-surface p-3 text-sm">{request.notes}</div>
        )}
      </SectionCard>
    </>
  );
}
