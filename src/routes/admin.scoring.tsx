import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ScoringPreviewPanel } from "@/components/admin/ScoringPreviewPanel";
import { useAuth } from "@/contexts/AuthContext";
import { logAdminAction } from "@/lib/audit-log";
import {
  bulkRecalculateAllScores,
  fetchActiveScoringConfig,
  saveScoringConfig,
  type ScoringConfig,
  type ScoringConfigRules,
} from "@/lib/scoring-config";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/scoring";

export const Route = createFileRoute("/admin/scoring")({
  component: ScoringConfigPage,
});

const CATEGORY_ORDER: CategoryKey[] = [
  "shelter",
  "medical",
  "dependents",
  "displacement",
  "household",
  "reference",
];

const CATEGORY_WEIGHT_FIELDS: Record<CategoryKey, { key: string; label: string }[]> = {
  shelter: [
    { key: "school_shelter", label: "مدرسة كمأوى" },
    { key: "informal_shelter", label: "مأوى غير رسمي" },
    { key: "destroyed_home", label: "المنزل مدمّر" },
    { key: "rented", label: "الإيجار" },
    { key: "with_relatives", label: "عند الأقارب" },
    { key: "other_housing", label: "أخرى" },
  ],
  medical: [
    { key: "medicine_need", label: "نقص أدوية" },
    { key: "chronic_illness", label: "مرض مزمن" },
    { key: "disabled", label: "إعاقة" },
  ],
  dependents: [
    { key: "infants", label: "رضّع" },
    { key: "elderly", label: "كبار السن" },
    { key: "pregnant_or_nursing", label: "حامل/مرضعة" },
    { key: "many_children", label: "أبناء كُثر" },
    { key: "infant_supplies", label: "مستلزمات الرضع" },
  ],
  displacement: [
    { key: "displaced_7d", label: "تشريد خلال ٧ أيام" },
    { key: "displaced_30d", label: "تشريد خلال ٣٠ يوماً" },
    { key: "displaced_90d", label: "تشريد خلال ٩٠ يوماً" },
  ],
  household: [
    { key: "family_8plus", label: "عائلة ٨+ أفراد" },
    { key: "family_6plus", label: "عائلة ٦+ أفراد" },
    { key: "family_4plus", label: "عائلة ٤+ أفراد" },
  ],
  reference: [
    { key: "reference_confirmed", label: "مرجع مؤكّد" },
    { key: "reference_denied", label: "مرجع مرفوض" },
  ],
};

function ScoringConfigPage() {
  const { roles, displayName } = useAuth();
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [rules, setRules] = useState<ScoringConfigRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const active = await fetchActiveScoringConfig();
        setConfig(active);
        setRules(active?.rules ?? null);
      } catch {
        setConfig(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!roles.includes("admin")) {
    return <Navigate to="/admin" />;
  }

  const updateCategoryMax = (key: CategoryKey, max: number) => {
    if (!rules) return;
    setRules({
      ...rules,
      categories: {
        ...rules.categories,
        [key]: {
          ...rules.categories[key],
          max,
        },
      },
    });
  };

  const updateCategoryWeight = (category: CategoryKey, weightKey: string, value: number) => {
    if (!rules) return;
    setRules({
      ...rules,
      categories: {
        ...rules.categories,
        [category]: {
          ...rules.categories[category],
          weights: {
            ...rules.categories[category]?.weights,
            [weightKey]: value,
          },
        },
      },
    });
  };

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    setMessage(null);
    try {
      const version = await saveScoringConfig(rules);
      await logAdminAction({
        action: "scoring_config_updated",
        newValue: { version, rules },
        actorName: displayName,
      });
      setMessage(`تم الحفظ — الإصدار ${version}. يمكنك إعادة احتساب جميع الطلبات لتطبيق السقوف الجديدة.`);
      const active = await fetchActiveScoringConfig();
      setConfig(active);
      setRules(active?.rules ?? rules);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkRecalc = async () => {
    setRecalculating(true);
    setRecalcProgress({ done: 0, total: 0 });
    setMessage(null);
    try {
      const result = await bulkRecalculateAllScores((done, total) => {
        setRecalcProgress({ done, total });
      });
      await logAdminAction({
        action: "score_recalculated",
        entity: "queue",
        newValue: { bulk: true, processed: result.processed, total: result.total },
        actorName: displayName,
      });
      setMessage(`تم إعادة احتساب ${result.processed.toLocaleString("ar-EG")} طلباً.`);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل إعادة الاحتساب");
    } finally {
      setRecalculating(false);
      setRecalcProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl">قواعد العجلة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تعديل سقف النقاط لكل فئة وسقف التطبيع. تُقرأ القيم النشطة عند كل احتساب.
        </p>
        {config && (
          <p className="mt-2 text-xs text-muted-foreground">
            الإصدار النشط: {config.version} · آخر تحديث:{" "}
            {new Date(config.updated_at).toLocaleString("ar-LB")}
          </p>
        )}
      </div>

      {!rules ? (
        <p className="text-sm text-muted-foreground">لا توجد إعدادات — طبّق migration v2.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid gap-4">
            {CATEGORY_ORDER.map((key) => (
              <div key={key} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-semibold">{CATEGORY_LABELS[key]}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rules.categories[key]?.max ?? 0}
                    onChange={(e) => updateCategoryMax(key, Number(e.target.value))}
                    className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {CATEGORY_WEIGHT_FIELDS[key].map((signal) => (
                    <label key={signal.key} className="space-y-1 text-xs">
                      <span className="text-muted-foreground">{signal.label}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rules.categories[key]?.weights?.[signal.key] ?? 0}
                        onChange={(e) =>
                          updateCategoryWeight(key, signal.key, Number(e.target.value))
                        }
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <label className="text-sm">سقف المجموع الخام (raw_max)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={rules.raw_max}
              onChange={(e) => setRules({ ...rules, raw_max: Number(e.target.value) })}
              className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm">حد أدنى الأولوية العاجلة</label>
            <input
              type="number"
              min={0}
              max={100}
              value={rules.priority_override_floor}
              onChange={(e) =>
                setRules({ ...rules, priority_override_floor: Number(e.target.value) })
              }
              className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={saving || recalculating}
              onClick={() => void handleSave()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ إصدار جديد"}
            </button>
            <button
              type="button"
              disabled={saving || recalculating}
              onClick={() => void handleBulkRecalc()}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:border-foreground/40 disabled:opacity-50"
            >
              {recalculating && <Loader2 className="h-4 w-4 animate-spin" />}
              إعادة احتساب الكل
            </button>
          </div>
          {recalcProgress && recalcProgress.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {recalcProgress.done.toLocaleString("ar-EG")} /{" "}
              {recalcProgress.total.toLocaleString("ar-EG")}
            </p>
          )}
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      )}

      <ScoringPreviewPanel key={previewKey} />
    </div>
  );
}
