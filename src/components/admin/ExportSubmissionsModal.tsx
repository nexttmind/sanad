import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { logAdminAction } from "@/lib/audit-log";
import {
  ASYNC_EXPORT_ROW_MAX,
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  SYNC_EXPORT_ROW_LIMIT,
  createExportJob,
  downloadCsv,
  ensureExportJobStored,
  exportFilename,
  fetchSubmissionsCsv,
  filterCsvColumns,
  countCsvDataRows,
  loadSavedExportColumns,
  runExportJobUntilComplete,
  saveExportColumns,
  type ExportColumnKey,
  type ExportJobStatus,
} from "@/lib/export-submissions";
import type { SubmissionFilters } from "@/lib/submissions-list";

type Props = {
  filters: SubmissionFilters;
  actorName: string;
  initialColumns?: ExportColumnKey[];
  onClose: () => void;
};

export function ExportSubmissionsModal({ filters, actorName, initialColumns, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asyncProgress, setAsyncProgress] = useState<ExportJobStatus | null>(null);
  const [selected, setSelected] = useState<ExportColumnKey[]>(
    () => initialColumns ?? loadSavedExportColumns(),
  );

  useEffect(() => {
    if (initialColumns?.length) setSelected(initialColumns);
  }, [initialColumns]);

  const toggleColumn = (key: ExportColumnKey) => {
    setSelected((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key);
        return next.length > 0 ? next : prev;
      }
      return [...prev, key];
    });
  };

  const finishExport = async (csv: string, meta: { asyncJob?: boolean; totalCount?: number }) => {
    saveExportColumns(selected);
    downloadCsv(csv, exportFilename());
    await logAdminAction({
      action: "export_csv",
      newValue: { filters, columns: selected },
      metadata: {
        row_count: countCsvDataRows(csv),
        async_job: meta.asyncJob ?? false,
        total_count: meta.totalCount,
      },
      actorName,
    });
    onClose();
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setAsyncProgress(null);
    try {
      const plan = await createExportJob(filters, selected);

      if (plan.mode === "async") {
        const csv = await runExportJobUntilComplete(plan.jobId, setAsyncProgress);
        await finishExport(csv, { asyncJob: true, totalCount: plan.totalCount });
        void ensureExportJobStored(plan.jobId).catch((err) => {
          console.warn("Failed to persist export to storage:", err);
        });
        return;
      }

      const raw = await fetchSubmissionsCsv(filters);
      const csv = filterCsvColumns(raw, selected);
      await finishExport(csv, { asyncJob: false, totalCount: plan.totalCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التصدير");
    } finally {
      setExporting(false);
      setAsyncProgress(null);
    }
  };

  const progressPct = asyncProgress?.progressPct ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="font-display text-lg">تصدير CSV</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الطلبات المطابقة للفلاتر الحالية. حتى {SYNC_EXPORT_ROW_LIMIT.toLocaleString("ar-LB")} صف
          يُنزَّل فوراً؛ أكثر من ذلك يُجهَّز في الخلفية (حتى{" "}
          {ASYNC_EXPORT_ROW_MAX.toLocaleString("ar-LB")} صف).
        </p>

        {asyncProgress && (
          <div className="mt-4 rounded-md border border-clay/30 bg-clay/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>جاري التجهيز في الخلفية…</span>
              <span className="font-mono">{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-clay transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {asyncProgress.processedCount.toLocaleString("ar-LB")} /{" "}
              {asyncProgress.totalCount.toLocaleString("ar-LB")} صف
            </p>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">الأعمدة</span>
            <button
              type="button"
              className="text-[11px] text-clay hover:underline"
              onClick={() => setSelected([...DEFAULT_EXPORT_COLUMNS])}
              disabled={exporting}
            >
              تحديد الكل
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 text-xs">
            {EXPORT_COLUMNS.map(({ key, label }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={() => toggleColumn(key)}
                    disabled={exporting}
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground/40 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || selected.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
            {asyncProgress ? "جاري التجهيز…" : `تنزيل (${selected.length} عمود)`}
          </button>
        </div>
      </div>
    </div>
  );
}
