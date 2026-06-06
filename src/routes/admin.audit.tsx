import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  maskIp,
  parseAuditDiff,
  type AuditAction,
} from "@/lib/audit-log";
import { EDITABLE_FIELD_LABELS } from "@/lib/request-form-constants";

type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];
type DbStatus = Database["public"]["Enums"]["request_status"];

const STATUS_AR: Record<DbStatus, string> = {
  submitted: "قيد الانتظار",
  reviewing: "قيد المراجعة",
  verifying: "التحقق",
  approved: "موافق عليه",
  distributed: "تم التوزيع",
  rejected: "مرفوض",
  on_hold: "معلّق",
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("ar-LB", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `اليوم — ${time}`;
  if (isYesterday) return `أمس — ${time}`;
  return d.toLocaleString("ar-LB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBeforeAfter(row: AuditRow): { before: string; after: string } {
  const { old_value: oldV, new_value: newV } = parseAuditDiff(row.diff);
  const action = row.action as AuditAction;

  switch (action) {
    case "status_change": {
      const oldStatus = oldV?.status as DbStatus | undefined;
      const newStatus = newV?.status as DbStatus | undefined;
      return {
        before: oldStatus ? (STATUS_AR[oldStatus] ?? String(oldStatus)) : "—",
        after: newStatus ? (STATUS_AR[newStatus] ?? String(newStatus)) : "—",
      };
    }
    case "note_added": {
      const content = newV?.content;
      return { before: "—", after: typeof content === "string" ? content.slice(0, 80) : "—" };
    }
    case "score_recalculated": {
      const oldTrust = oldV?.trust_score;
      const newTrust = newV?.trust_score;
      return {
        before: oldTrust != null ? String(oldTrust) : "—",
        after: newTrust != null ? String(newTrust) : "—",
      };
    }
    case "document_rejected": {
      const reason = newV?.reason;
      return { before: "—", after: typeof reason === "string" ? reason.slice(0, 60) : "—" };
    }
    case "reference_contacted": {
      const result = newV?.result;
      return { before: "بانتظار", after: typeof result === "string" ? result : "—" };
    }
    case "fraud_resolved": {
      const code = newV?.flag_code;
      return { before: "—", after: typeof code === "string" ? code : "—" };
    }
    case "tag_added":
    case "tag_removed": {
      const tag = newV?.tag;
      return { before: action === "tag_removed" ? (typeof tag === "string" ? tag : "—") : "—", after: action === "tag_added" ? (typeof tag === "string" ? tag : "—") : "—" };
    }
    case "reviewer_assigned":
      return { before: "—", after: typeof newV?.reviewer_id === "string" ? "تم التعيين" : "—" };
    case "export_csv":
      return { before: "—", after: "تم التصدير" };
    case "field_updated": {
      const changed = newV ? Object.keys(newV) : [];
      const labels = changed.map((k) => EDITABLE_FIELD_LABELS[k] ?? k).join("، ");
      return { before: "—", after: changed.length ? labels.slice(0, 80) : "—" };
    }
    case "donation_verified":
    case "donation_rejected": {
      const oldStatus = oldV?.status;
      const newStatus = newV?.status;
      return {
        before: typeof oldStatus === "string" ? oldStatus : "—",
        after: typeof newStatus === "string" ? newStatus : "—",
      };
    }
    default:
      return { before: "—", after: "—" };
  }
}

function targetLabel(row: AuditRow): string {
  const { metadata, new_value: newV } = parseAuditDiff(row.diff);
  if (typeof metadata?.reference_code === "string") return metadata.reference_code;
  if (typeof newV?.reference_code === "string") return newV.reference_code;
  if (row.entity_id) return row.entity_id.slice(0, 8) + "…";
  return "—";
}

export const Route = createFileRoute("/admin/audit")({
  component: Audit,
});

function Audit() {
  const { role, roles, displayName, loading: authLoading } = useAuth();
  const isAdmin = role === "admin" || roles.includes("admin");

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999`);

    const { data, error: qError } = await query;
    if (qError) {
      setError("تعذّر تحميل سجلّ التدقيق.");
      if (import.meta.env.DEV) console.error("[Audit] load failed:", qError);
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [isAdmin, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayRows = useMemo(
    () =>
      rows.map((row) => {
        const parsed = parseAuditDiff(row.diff);
        const actorName =
          typeof parsed.metadata?.actor_name === "string"
            ? parsed.metadata.actor_name
            : "—";
        const { before, after } = formatBeforeAfter(row);
        const action = row.action as AuditAction;
        return {
          id: row.id,
          who: actorName,
          action: AUDIT_ACTION_LABELS[action] ?? row.action,
          target: targetLabel(row),
          before,
          after,
          ip: maskIp(parsed.ip_address),
          when: formatWhen(row.created_at),
        };
      }),
    [rows],
  );

  if (authLoading) {
    return <div className="p-8 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg">سجلّ التدقيق</p>
        <p className="mt-2 text-sm text-muted-foreground">
          هذه الصفحة متاحة للمدراء فقط.{displayName ? ` (${displayName})` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        للقراءة فقط — لا يمكن تعديل أو حذف هذه السجلات.
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">إلى تاريخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">نوع الإجراء</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | "all")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">الكل</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
            setActionFilter("all");
          }}
          className="rounded-md border border-border px-3 py-2 text-xs hover:border-foreground/40"
        >
          مسح الفلاتر
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">الإداري</th>
              <th className="px-4 py-3 font-medium">الإجراء</th>
              <th className="px-4 py-3 font-medium">الهدف</th>
              <th className="px-4 py-3 font-medium">قبل</th>
              <th className="px-4 py-3 font-medium">بعد</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">الوقت</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  لا توجد سجلات بعد.
                </td>
              </tr>
            )}
            {!loading &&
              displayRows.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{l.who}</td>
                  <td className="px-4 py-3">{l.action}</td>
                  <td className="px-4 py-3">
                    <span dir="ltr" className="font-mono text-xs">
                      {l.target}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.before}</td>
                  <td className="px-4 py-3 text-xs">{l.after}</td>
                  <td className="px-4 py-3">
                    <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                      {l.ip}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.when}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
