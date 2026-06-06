import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createSavedView,
  deleteSavedView,
  fetchSavedViews,
  type SavedView,
} from "@/lib/saved-views";
import type { SubmissionFilters, SubmissionSort } from "@/lib/submissions-list";
import type { ExportColumnKey } from "@/lib/export-submissions";

type Props = {
  filters: SubmissionFilters;
  sort: SubmissionSort;
  exportColumns: ExportColumnKey[];
  isAdmin: boolean;
  onApply: (view: SavedView) => void;
};

export function SavedViewsDropdown({ filters, sort, exportColumns, isAdmin, onApply }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setViews(await fetchSavedViews());
    } catch {
      setViews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const saveCurrent = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createSavedView({
        name: name.trim(),
        filters,
        sort,
        columns: exportColumns,
        isShared: isAdmin ? isShared : false,
      });
      setName("");
      setIsShared(false);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await deleteSavedView(id);
    await reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border px-3 py-2 text-sm hover:border-foreground/40"
      >
        العروض المحفوظة
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {views.length === 0 && (
                <li className="py-2 text-xs text-muted-foreground">لا توجد عروض محفوظة.</li>
              )}
              {views.map((v) => (
                <li key={v.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex-1 truncate rounded px-2 py-1 text-right hover:bg-surface"
                    onClick={() => {
                      onApply(v);
                      setOpen(false);
                    }}
                  >
                    {v.name}
                    {v.is_shared && (
                      <span className="ms-1 text-[10px] text-muted-foreground">(مشترك)</span>
                    )}
                    {v.columns?.length ? (
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        · {v.columns.length} عمود
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-destructive hover:underline"
                    onClick={() => void remove(v.id)}
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم العرض الجديد"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
            {isAdmin && (
              <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                />
                مشترك مع كل الموظفين
              </label>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              يحفظ الفلاتر والترتيب وأعمدة التصدير ({exportColumns.length} عمود).
            </p>
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void saveCurrent()}
              className="mt-2 w-full rounded-md border border-border py-1.5 text-xs hover:border-clay disabled:opacity-50"
            >
              حفظ العرض الحالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
