import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminTableRealtime } from "@/lib/use-admin-realtime";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStaffMembers, staffMapById, type StaffMember } from "@/lib/admin-staff";
import {
  formatQueueNumber,
  formatWaitDuration,
} from "@/lib/queue";
import { bulkAssignReviewer, selectTopForBulkAssign } from "@/lib/queue-assign";
import { listSubmissions } from "@/lib/submissions-list";
import { QueueIntegrityPanel } from "@/components/admin/QueueIntegrityPanel";
import { ExportSubmissionsModal } from "@/components/admin/ExportSubmissionsModal";
import {
  AdminDesktopTable,
  AdminMobileCard,
  AdminMobileCardActions,
  AdminMobileCardGrid,
  AdminMobileCardHeader,
  AdminMobileCardLink,
  AdminMobileList,
} from "@/components/admin/AdminMobileCard";
import { loadSavedExportColumns, type ExportColumnKey } from "@/lib/export-submissions";
import type { AidRowExtended } from "@/lib/request-detail-types";
import {
  TIER_BADGE_CLASS,
  TIER_LABELS,
  urgencyScoreColor,
  type UrgencyTier,
} from "@/lib/scoring";

export const Route = createFileRoute("/admin/queue")({
  component: WorkQueue,
});

const STATUS_AR = {
  submitted: "قيد الانتظار",
  reviewing: "قيد المراجعة",
} as const;

function WorkQueue() {
  const { displayName } = useAuth();
  const [rows, setRows] = useState<AidRowExtended[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"submitted" | "reviewing">("submitted");

  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [bulkCount, setBulkCount] = useState(5);
  const [includeAssigned, setIncludeAssigned] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listSubmissions(
        { status: tab },
        { field: "effective_urgency", direction: "desc" },
        null,
        100,
      );
      setRows(result.rows);
      const members = await fetchStaffMembers().catch(() => []);
      setStaff(members);
      setStaffNames(staffMapById(members));
    } catch (err) {
      setRows([]);
      setLoadError(err instanceof Error ? err.message : "تعذّر تحميل الدور");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useAdminTableRealtime("admin-queue", "aid_requests", () => {
    void load();
  });

  const handleBulkAssign = async () => {
    setBulkBusy(true);
    setBulkMessage(null);
    const picked = selectTopForBulkAssign(
      rows.map((r) => ({
        id: r.id,
        reference_code: r.reference_code,
        assigned_to: r.assigned_to,
      })),
      bulkCount,
      includeAssigned,
    );
    const result = await bulkAssignReviewer(picked, bulkReviewerId, displayName);
    if (!result.ok) {
      setBulkMessage(result.message);
    } else {
      setBulkMessage(`تم تعيين ${result.assigned} طلباً إلى المراجع المختار.`);
      await load();
    }
    setBulkBusy(false);
  };

  const unassignedInView = rows.filter((r) => !r.assigned_to).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          دور العمل — ترتيب: العجلة الفعّالة ثم رقم الدور (FIFO)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-xs text-foreground hover:border-foreground/40"
          >
            تصدير CSV
          </button>
          {(["submitted", "reviewing"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={[
                "rounded-full border px-4 py-1.5 text-xs",
                tab === s
                  ? "border-clay bg-clay/10 text-clay"
                  : "border-border hover:border-foreground/40",
              ].join(" ")}
            >
              {STATUS_AR[s]}
            </button>
          ))}
        </div>
      </div>

      <QueueIntegrityPanel />

      {tab === "submitted" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">تعيين جماعي — أول طلبات الدور</div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">المراجع</span>
              <select
                value={bulkReviewerId}
                onChange={(e) => setBulkReviewerId(e.target.value)}
                disabled={bulkBusy || staff.length === 0}
                className="block w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm sm:w-auto sm:min-w-[180px]"
              >
                <option value="">— اختر مراجعاً —</option>
                {staff.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name} ({m.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">عدد الطلبات</span>
              <input
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                disabled={bulkBusy}
                className="block w-20 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeAssigned}
                onChange={(e) => setIncludeAssigned(e.target.checked)}
                disabled={bulkBusy}
              />
              تضمين المعيّن مسبقاً
            </label>
            <button
              type="button"
              disabled={bulkBusy || !bulkReviewerId || rows.length === 0}
              onClick={() => void handleBulkAssign()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              تعيين أول {bulkCount}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {unassignedInView} طلباً غير معيّن في العرض الحالي (حتى 100 صف).
          </p>
          {bulkMessage && (
            <p className="mt-2 text-xs text-clay">{bulkMessage}</p>
          )}
        </div>
      )}

      {loadError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {loadError}
        </p>
      )}

      {showExport && (
        <ExportSubmissionsModal
          filters={{ status: tab }}
          actorName={displayName}
          initialColumns={loadSavedExportColumns()}
          onClose={() => setShowExport(false)}
        />
      )}

      <div className="rounded-xl border border-border bg-card">
        <AdminDesktopTable>
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase text-muted-foreground">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">المنطقة</th>
              <th className="px-4 py-3">العجلة</th>
              <th className="px-4 py-3">الانتظار</th>
              <th className="px-4 py-3">المراجع</th>
              <th className="px-4 py-3"></th>
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
            {!loading &&
              rows.map((s) => {
                const urg = s.effective_urgency ?? s.urgency_score;
                const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
                return (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-surface">
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatQueueNumber(s.queue_number)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.full_name}</div>
                      <div dir="ltr" className="font-mono text-[10px] text-muted-foreground">
                        {s.reference_code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.governorate}</td>
                    <td className="px-4 py-3">
                      <span className={["font-mono text-xs", urgencyScoreColor(urg)].join(" ")}>
                        {urg}
                      </span>
                      {s.urgency_tier && (
                        <span
                          className={[
                            "ms-2 rounded-full border px-1.5 py-0.5 text-[9px]",
                            TIER_BADGE_CLASS[tierKey],
                          ].join(" ")}
                        >
                          {TIER_LABELS[tierKey]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatWaitDuration(s.queued_at ?? s.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.assigned_to ? (staffNames[s.assigned_to] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link to="/admin/requests/$id" params={{ id: s.id }} className="text-clay hover:underline">
                        عرض
                      </Link>
                    </td>
                  </tr>
                );
              })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  لا توجد طلبات في هذا الدور.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </AdminDesktopTable>

        <AdminMobileList
          loading={loading}
          empty={!loading && rows.length === 0}
          emptyMessage="لا توجد طلبات في هذا الدور."
        >
          {rows.map((s) => {
            const urg = s.effective_urgency ?? s.urgency_score;
            const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
            return (
              <AdminMobileCard key={s.id}>
                <AdminMobileCardHeader
                  title={s.full_name}
                  mono={s.reference_code}
                  badge={
                    s.urgency_tier ? (
                      <span className={["rounded-full border px-2 py-0.5 text-[10px]", TIER_BADGE_CLASS[tierKey]].join(" ")}>
                        {TIER_LABELS[tierKey]}
                      </span>
                    ) : undefined
                  }
                />
                <AdminMobileCardGrid
                  rows={[
                    { label: "الدور", value: formatQueueNumber(s.queue_number) },
                    { label: "المنطقة", value: s.governorate ?? "—" },
                    { label: "العجلة", value: <span className={urgencyScoreColor(urg)}>{urg}</span> },
                    { label: "الانتظار", value: formatWaitDuration(s.queued_at ?? s.created_at) },
                    { label: "المراجع", value: s.assigned_to ? (staffNames[s.assigned_to] ?? "—") : "—" },
                  ]}
                />
                <AdminMobileCardActions>
                  <AdminMobileCardLink to="/admin/requests/$id" params={{ id: s.id }}>
                    عرض ←
                  </AdminMobileCardLink>
                </AdminMobileCardActions>
              </AdminMobileCard>
            );
          })}
        </AdminMobileList>
      </div>
    </div>
  );
}
