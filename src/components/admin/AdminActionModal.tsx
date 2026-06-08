import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export type AdminActionPreviewRow = {
  label: string;
  value: React.ReactNode;
};

export type AdminActionSelectOption = {
  value: string;
  label: string;
};

type Props = {
  open: boolean;
  title: string;
  description?: string;
  preview?: AdminActionPreviewRow[];
  cannedReasons?: string[];
  reasonLabel?: string;
  reasonPlaceholder?: string;
  requireReason?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "success" | "default";
  busy?: boolean;
  selectLabel?: string;
  selectOptions?: AdminActionSelectOption[];
  selectValue?: string;
  onConfirm: (payload: { reason: string; selected?: string }) => void | Promise<void>;
  onClose: () => void;
};

export function AdminActionModal({
  open,
  title,
  description,
  preview,
  cannedReasons = [],
  reasonLabel = "السبب",
  reasonPlaceholder = "اكتب التفاصيل...",
  requireReason = false,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  variant = "default",
  busy = false,
  selectLabel,
  selectOptions,
  selectValue,
  onConfirm,
  onClose,
}: Props) {
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState(selectValue ?? selectOptions?.[0]?.value ?? "");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setSelected(selectValue ?? selectOptions?.[0]?.value ?? "");
  }, [open, selectValue, selectOptions]);

  if (!open) return null;

  const confirmClass =
    variant === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : variant === "success"
        ? "bg-success text-white hover:bg-success/90"
        : "bg-primary text-primary-foreground hover:bg-primary/90";

  const canConfirm =
    !busy &&
    (!requireReason || reason.trim().length > 0) &&
    (!selectOptions?.length || selected.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-action-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 id="admin-action-modal-title" className="font-display text-lg">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

        {preview && preview.length > 0 && (
          <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
            {preview.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {selectOptions && selectOptions.length > 0 && (
          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block text-xs text-muted-foreground">{selectLabel ?? "اختر"}</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {selectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {cannedReasons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cannedReasons.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition",
                  reason === item
                    ? "border-clay bg-clay/10 text-clay"
                    : "border-border hover:border-clay/60",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {(cannedReasons.length > 0 || requireReason || !selectOptions?.length) && (
          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              {reasonLabel}
              {requireReason && <span className="text-clay"> *</span>}
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground/40 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void onConfirm({ reason: reason.trim(), selected })}
            className={["inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-50", confirmClass].join(" ")}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
