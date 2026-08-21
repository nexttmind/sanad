import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { logAdminAction } from "@/lib/audit-log";
import {
  AID_FORM_FIELD_TYPE_LABELS,
  allAidFormFields,
  cloneDefaultAidFormSchema,
  fetchAidFormSchema,
  isLockedAidFormBinding,
  newFieldId,
  newSectionId,
  saveAidFormSchema,
  type AidFormField,
  type AidFormFieldBinding,
  type AidFormFieldType,
  type AidFormSchema,
  type AidFormSection,
} from "@/lib/aid-form-schema";

export const Route = createFileRoute("/admin/form-settings")({
  component: FormSettingsPage,
});

const BINDING_OPTIONS: { value: AidFormFieldBinding | ""; label: string }[] = [
  { value: "", label: "— حقل مخصّص (يُحفظ مع الطلب) —" },
  { value: "first_name", label: "الاسم الأول" },
  { value: "father_name", label: "اسم الأب" },
  { value: "family_name", label: "اسم العائلة" },
  { value: "phone", label: "الهاتف الأساسي" },
  { value: "alt_phone", label: "الهاتف الثانوي" },
  { value: "family_size", label: "حجم العائلة" },
  { value: "children", label: "أطفال" },
  { value: "infants", label: "رضّع" },
  { value: "has_elderly", label: "يوجد كبار سن" },
  { value: "elderly_count", label: "عدد كبار السن" },
  { value: "has_disabled", label: "ذوو إعاقة" },
  { value: "disabled_desc", label: "وصف الإعاقة" },
  { value: "has_chronic", label: "مرض مزمن" },
  { value: "chronic_desc", label: "وصف المرض" },
  { value: "pregnant_or_nursing", label: "حامل/مرضع" },
  { value: "displaced", label: "نازح" },
  { value: "origin", label: "قضاء" },
  { value: "origin_village", label: "مكان الإقامة السابق" },
  { value: "current_loc", label: "الموقع الحالي" },
  { value: "shelter", label: "نوع المأوى" },
  { value: "shelter_name", label: "اسم المأوى" },
  { value: "displacement_date", label: "تاريخ النزوح" },
  { value: "needs", label: "الاحتياجات (متعدد)" },
  { value: "diaper_size", label: "قياس الحفاض" },
  { value: "infant_age", label: "عمر الرضيع (حفاض)" },
  { value: "milk_brand", label: "ماركة الحليب" },
  { value: "milk_stage", label: "مرحلة الحليب" },
  { value: "milk_age", label: "عمر الرضيع (حليب)" },
  { value: "clothes_desc", label: "تفاصيل الملابس" },
  { value: "other_desc", label: "وصف حاجة أخرى" },
  { value: "notes", label: "ملاحظات عامة" },
  { value: "ref_type", label: "نوع المرجع" },
  { value: "ref_name", label: "اسم المرجع" },
  { value: "ref_phone", label: "هاتف المرجع" },
  { value: "ref_region", label: "منطقة المرجع" },
  { value: "ref_village", label: "قرية المرجع" },
  { value: "ref_known", label: "مدة المعرفة" },
  { value: "ref_notes", label: "ملاحظات المرجع" },
  { value: "confirm", label: "تأكيد الإرسال" },
];

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";

function FormSettingsPage() {
  const { displayName } = useAuth();
  const [schema, setSchema] = useState<AidFormSchema>(cloneDefaultAidFormSchema());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await fetchAidFormSchema(true);
        setSchema(loaded);
        setOpenSections(Object.fromEntries(loaded.sections.map((s) => [s.id, true])));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateSection = (sectionId: string, patch: Partial<AidFormSection>) => {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec) => (sec.id === sectionId ? { ...sec, ...patch } : sec)),
    }));
  };

  const updateField = (sectionId: string, fieldId: string, patch: Partial<AidFormField>) => {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId
          ? {
              ...sec,
              fields: sec.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
            }
          : sec,
      ),
    }));
  };

  const addSection = () => {
    const id = newSectionId();
    setSchema((s) => ({
      ...s,
      sections: [
        ...s.sections,
        {
          id,
          number_label: String(s.sections.length + 1).padStart(2, "0"),
          title: "قسم جديد",
          fields: [],
        },
      ],
    }));
    setOpenSections((o) => ({ ...o, [id]: true }));
  };

  const removeSection = (sectionId: string) => {
    if (sectionId === "reference" || sectionId === "personal" || sectionId === "review") {
      setMessage("لا يمكن حذف أقسام الاسم أو المرجع أو التأكيد — فهي أساسية للطلب.");
      return;
    }
    if (!confirm("حذف هذا القسم وجميع حقوله؟")) return;
    setSchema((s) => ({ ...s, sections: s.sections.filter((sec) => sec.id !== sectionId) }));
  };

  const addField = (sectionId: string) => {
    const field: AidFormField = {
      id: newFieldId(),
      type: "text",
      label: "سؤال جديد",
      required: false,
    };
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, fields: [...sec.fields, field] } : sec,
      ),
    }));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    const field = schema.sections.flatMap((s) => s.fields).find((f) => f.id === fieldId);
    if (isLockedAidFormBinding(field?.binding)) {
      setMessage("لا يمكن حذف هذا الحقل — مطلوب لإرسال الطلب.");
      return;
    }
    if (!confirm("حذف هذا السؤال؟")) return;
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, fields: sec.fields.filter((f) => f.id !== fieldId) } : sec,
      ),
    }));
  };

  const moveField = (sectionId: string, fieldId: string, dir: -1 | 1) => {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const idx = sec.fields.findIndex((f) => f.id === fieldId);
        if (idx < 0) return sec;
        const next = idx + dir;
        if (next < 0 || next >= sec.fields.length) return sec;
        const fields = [...sec.fields];
        [fields[idx], fields[next]] = [fields[next], fields[idx]];
        return { ...sec, fields };
      }),
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const normalized: AidFormSchema = {
        ...schema,
        version: schema.version + 1,
        sections: schema.sections.map((sec) => ({
          ...sec,
          fields: sec.fields.map((f) =>
            isLockedAidFormBinding(f.binding) ? { ...f, required: true } : f,
          ),
        })),
      };
      const version = await saveAidFormSchema(normalized);
      setSchema((s) => ({ ...normalized, version }));
      await logAdminAction({
        action: "aid_form_schema_updated",
        actorName: displayName,
        metadata: { version, sections: schema.sections.length },
      });
      setMessage("تم حفظ نموذج الطلب.");
    } catch {
      setMessage("تعذّر حفظ النموذج.");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!confirm("استعادة النموذج الافتراضي؟ سيتم فقدان التغييرات غير المحفوظة.")) return;
    setSchema(cloneDefaultAidFormSchema());
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">إعدادات نموذج الطلب</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف أو عدّل أسئلة النموذج العام — الأقسام، أنواع الحقول، وخيارات القوائم.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAdvancedMode((v) => !v)}
            className={[
              "rounded-full border px-4 py-2 text-sm",
              advancedMode ? "border-clay bg-clay/10 text-clay" : "border-border hover:border-clay",
            ].join(" ")}
          >
            {advancedMode ? "وضع بسيط" : "إعدادات متقدمة"}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-full border border-border px-4 py-2 text-sm hover:border-clay"
          >
            {showPreview ? "إخفاء المعاينة" : "معاينة الأسئلة"}
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-full border border-border px-4 py-2 text-sm hover:border-clay"
          >
            استعادة الافتراضي
          </button>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm hover:border-clay"
          >
            <Plus className="h-4 w-4" /> قسم
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">{message}</div>
      )}

      {showPreview && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm font-medium">معاينة سريعة للنموذج العام</div>
          <div className="space-y-4">
            {schema.sections.map((sec) => (
              <div key={sec.id}>
                <div className="font-display text-base">
                  {sec.number_label} — {sec.title}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {sec.fields.map((f) => (
                    <li key={f.id}>
                      {f.label}
                      {(f.required || isLockedAidFormBinding(f.binding)) && (
                        <span className="text-clay"> *</span>
                      )}
                      {f.parent_option && (
                        <span className="text-xs"> (يظهر مع: {f.parent_option})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {schema.sections.map((section, sIdx) => (
          <div key={section.id} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
              onClick={() => setOpenSections((o) => ({ ...o, [section.id]: !o[section.id] }))}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {section.number_label} — {section.title}
                </div>
                <div className="text-xs text-muted-foreground">{section.fields.length} حقول</div>
              </div>
              {openSections[section.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {openSections[section.id] && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">رقم القسم</span>
                    <input
                      className={inputCls}
                      value={section.number_label}
                      onChange={(e) => updateSection(section.id, { number_label: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-1 block text-muted-foreground">عنوان القسم</span>
                    <input
                      className={inputCls}
                      value={section.title}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm md:col-span-3">
                    <span className="mb-1 block text-muted-foreground">وصف فرعي (اختياري)</span>
                    <input
                      className={inputCls}
                      value={section.subtitle ?? ""}
                      onChange={(e) => updateSection(section.id, { subtitle: e.target.value || undefined })}
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  {section.fields.map((field, fIdx) => (
                    <div key={field.id} className="rounded-lg border border-border/80 bg-background p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">حقل {fIdx + 1}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={fIdx === 0}
                            onClick={() => moveField(section.id, field.id, -1)}
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={fIdx === section.fields.length - 1}
                            onClick={() => moveField(section.id, field.id, 1)}
                            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={isLockedAidFormBinding(field.binding)}
                            onClick={() => removeField(section.id, field.id)}
                            className="rounded border border-destructive/40 px-2 py-1 text-xs text-destructive disabled:opacity-40"
                            title={isLockedAidFormBinding(field.binding) ? "حقل أساسي لا يمكن حذفه" : "حذف"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block text-sm md:col-span-2">
                          <span className="mb-1 block text-muted-foreground">نص السؤال</span>
                          <input
                            className={inputCls}
                            value={field.label}
                            onChange={(e) => updateField(section.id, field.id, { label: e.target.value })}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-muted-foreground">نوع الحقل</span>
                          <select
                            className={inputCls}
                            value={field.type}
                            onChange={(e) =>
                              updateField(section.id, field.id, { type: e.target.value as AidFormFieldType })
                            }
                          >
                            {(Object.entries(AID_FORM_FIELD_TYPE_LABELS) as [AidFormFieldType, string][]).map(
                              ([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        {advancedMode && (
                        <label className="block text-sm">
                          <span className="mb-1 block text-muted-foreground">ربط بالحقل الأساسي</span>
                          <select
                            className={inputCls}
                            value={field.binding ?? ""}
                            disabled={isLockedAidFormBinding(field.binding)}
                            onChange={(e) =>
                              updateField(section.id, field.id, {
                                binding: (e.target.value || undefined) as AidFormFieldBinding | undefined,
                              })
                            }
                          >
                            {BINDING_OPTIONS.map((o) => (
                              <option key={o.value || "custom"} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!field.required || isLockedAidFormBinding(field.binding)}
                            disabled={isLockedAidFormBinding(field.binding)}
                            onChange={(e) => updateField(section.id, field.id, { required: e.target.checked })}
                          />
                          مطلوب
                          {isLockedAidFormBinding(field.binding) && (
                            <span className="text-[11px] text-muted-foreground">(أساسي)</span>
                          )}
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-muted-foreground">تلميح (اختياري)</span>
                          <input
                            className={inputCls}
                            value={field.hint ?? ""}
                            onChange={(e) => updateField(section.id, field.id, { hint: e.target.value || undefined })}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-muted-foreground">نص توضيحي داخل الحقل</span>
                          <input
                            className={inputCls}
                            value={field.placeholder ?? ""}
                            onChange={(e) =>
                              updateField(section.id, field.id, { placeholder: e.target.value || undefined })
                            }
                          />
                        </label>
                        {(field.type === "select" || field.type === "multiselect") && (
                          <label className="block text-sm md:col-span-2">
                            <span className="mb-1 block text-muted-foreground">خيارات القائمة (سطر لكل خيار)</span>
                            <textarea
                              rows={4}
                              className={inputCls}
                              value={(field.options ?? []).join("\n")}
                              onChange={(e) =>
                                updateField(section.id, field.id, {
                                  options: e.target.value
                                    .split("\n")
                                    .map((l) => l.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          </label>
                        )}
                        {section.id === "needs" && field.type !== "multiselect" && (
                          <label className="block text-sm md:col-span-2">
                            <span className="mb-1 block text-muted-foreground">
                              يظهر عند اختيار هذا الاحتياج
                            </span>
                            <input
                              className={inputCls}
                              value={field.parent_option ?? ""}
                              onChange={(e) =>
                                updateField(section.id, field.id, {
                                  parent_option: e.target.value || undefined,
                                })
                              }
                              placeholder="مثال: حفاضات"
                            />
                          </label>
                        )}
                        {advancedMode && field.binding !== "needs" && (
                          <label className="block text-sm md:col-span-2">
                            <span className="mb-1 block text-muted-foreground">
                              أظهر هذا السؤال عندما
                            </span>
                            <div className="grid gap-2 md:grid-cols-3">
                              <select
                                className={inputCls}
                                value={field.visible_when?.field_id ?? ""}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    visible_when: e.target.value
                                      ? {
                                          field_id: e.target.value,
                                          op: field.visible_when?.op ?? "truthy",
                                          value: field.visible_when?.value,
                                        }
                                      : undefined,
                                  })
                                }
                              >
                                <option value="">— دائماً ظاهر —</option>
                                {allAidFormFields(schema)
                                  .filter((f) => f.id !== field.id)
                                  .map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.label}
                                    </option>
                                  ))}
                              </select>
                              <select
                                className={inputCls}
                                value={field.visible_when?.op ?? "truthy"}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    visible_when: field.visible_when
                                      ? {
                                          ...field.visible_when,
                                          op: e.target.value as "eq" | "truthy" | "includes",
                                        }
                                      : undefined,
                                  })
                                }
                              >
                                <option value="truthy">يكون نعم / مفعّلاً</option>
                                <option value="eq">يساوي</option>
                                <option value="includes">يتضمن</option>
                              </select>
                              <input
                                className={inputCls}
                                placeholder="القيمة (إن لزم)"
                                value={String(field.visible_when?.value ?? "")}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    visible_when: field.visible_when
                                      ? { ...field.visible_when, value: e.target.value || undefined }
                                      : undefined,
                                  })
                                }
                              />
                            </div>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addField(section.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-clay"
                  >
                    <Plus className="h-3.5 w-3.5" /> إضافة سؤال
                  </button>
                  {sIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> حذف القسم
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
