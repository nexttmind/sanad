import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminActionModal } from "@/components/admin/AdminActionModal";
import {
  bulkAddTagToRequests,
  bulkAssignRequests,
  bulkUpdateRequestStatus,
} from "@/lib/bulk-request-actions";
import { canExport, exportSelectedSubmissions, loadSavedExportColumns, resolveExportColumns, saveExportColumns, type ExportColumnKey } from "@/lib/export-submissions";
import { staffMapById } from "@/lib/admin-staff";
import { useAdminFilterTags, useAdminStaff, adminQueryKeys } from "@/lib/admin-query";
import { useAdminQueryRealtime } from "@/lib/use-admin-query-realtime";
import {
  invalidateSubmissionsListQueries,
  useDailyBatchSubmissions,
  useSubmissionsList,
  useSubmissionsListDerived,
} from "@/lib/use-submissions-list-query";
import {
  batchRangeLabel,
  beirutTodayIso,
  totalBatches,
} from "@/lib/daily-batch";
import { matchQuickFilter, quickFilterPresets, type QuickFilterId } from "@/lib/request-quick-filters";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { ExportSubmissionsModal } from "@/components/admin/ExportSubmissionsModal";
import { SavedViewsDropdown } from "@/components/admin/SavedViewsDropdown";
import type { AidRowExtended, FileRowExtended } from "@/lib/request-detail-types";
import { formatQueueNumber } from "@/lib/queue";
import {
  GOVERNORATE_OPTIONS,
  loadSavedPageSize,
  PAGE_SIZE_OPTIONS,
  parseSortFromSearch,
  savePageSize,
  SORT_FIELD_LABELS,
  REFERENCE_RESULT_FILTER_OPTIONS,
  type ReferenceResultFilter,
  type PageSize,
  type SortField,
  type SubmissionFilters,
} from "@/lib/submissions-list";
import {
  TIER_BADGE_CLASS,
  TIER_LABELS,
  urgencyBarColor,
  urgencyScoreColor,
  type UrgencyTier,
} from "@/lib/scoring";
import type { SavedView } from "@/lib/saved-views";
import {
  AdminDesktopTable,
  AdminMobileCard,
  AdminMobileCardActions,
  AdminMobileCardGrid,
  AdminMobileCardHeader,
  AdminMobileCardLink,
  AdminMobileList,
} from "@/components/admin/AdminMobileCard";

type Row = AidRowExtended;
type DbStatus = Database["public"]["Enums"]["request_status"];

function docStatusLabel(files: FileRowExtended[]): string {
  if (files.length === 0) return "—";
  if (files.some((f) => f.doc_rejection_reason)) return "مرفوض";
  if (files.every((f) => f.doc_admin_verified)) return "تم التحقق";
  if (files.some((f) => f.doc_admin_verified)) return "جزئي";
  return "بانتظار";
}

const STATUS_AR: Record<DbStatus, string> = {
  submitted: "قيد الانتظار",
  reviewing: "قيد المراجعة",
  verifying: "التحقق",
  approved: "موافق عليه",
  distributed: "تم التوزيع",
  rejected: "مرفوض",
  on_hold: "معلّق",
};

const statusColor: Record<DbStatus, string> = {
  submitted: "bg-warning/15 text-warning border-warning/40",
  reviewing: "bg-accent/15 text-accent border-accent/40",
  verifying: "bg-accent/15 text-accent border-accent/40",
  approved: "bg-success/15 text-success border-success/40",
  distributed: "bg-foreground/10 text-foreground border-foreground/25",
  rejected: "bg-destructive/15 text-destructive border-destructive/40",
  on_hold: "bg-warning/15 text-warning border-warning/40",
};

const BULK_STATUS_OPTIONS: { value: DbStatus; label: string }[] = [
  { value: "reviewing", label: "قيد المراجعة" },
  { value: "on_hold", label: "معلّق" },
  { value: "approved", label: "موافق عليه" },
  { value: "rejected", label: "مرفوض" },
  { value: "distributed", label: "تم التوزيع" },
];

const NEEDS_OPTIONS = [
  "طعام",
  "ملابس",
  "أدوية",
  "وسائد وفرش",
  "حفاضات",
  "حليب أطفال",
  "مروحة",
  "غاز",
  "مواد نظافة",
  "أغطية وبطانيات",
  "أخرى",
];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `قبل ${Math.floor(diff)} ث`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return `قبل ${Math.floor(diff / 86400)} ي`;
}

export const Route = createFileRoute("/admin/requests/")({
  component: RequestsList,
  validateSearch: (search: Record<string, unknown>) => ({
    sort: typeof search.sort === "string" ? search.sort : undefined,
    dir: typeof search.dir === "string" ? search.dir : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    tier: typeof search.tier === "string" ? search.tier : undefined,
    risk: typeof search.risk === "string" ? search.risk : undefined,
    urgency_min: typeof search.urgency_min === "string" ? search.urgency_min : undefined,
    flags: search.flags === "1" ? "1" : undefined,
  }) as {
    sort?: string;
    dir?: string;
    q?: string;
    status?: string;
    tier?: string;
    risk?: string;
    urgency_min?: string;
    flags?: string;
  },
});

function RequestsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const { displayName, roles, user } = useAuth();
  const sort = useMemo(
    () => parseSortFromSearch(new URLSearchParams(search as Record<string, string>)),
    [search],
  );

  const [showExport, setShowExport] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportColumnKey[]>(() => loadSavedExportColumns());

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<DbStatus | "all">("all");
  const [risk, setRisk] = useState<"all" | "high" | "medium" | "low" | "critical" | "fraud">("all");
  const [tier, setTier] = useState<"all" | UrgencyTier>("all");
  const [governorate, setGovernorate] = useState<string>("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const { data: allTags = [] } = useAdminFilterTags();
  const { data: staff = [] } = useAdminStaff();
  const [pageSize, setPageSize] = useState<PageSize>(() => loadSavedPageSize());
  const [dailyBatchEnabled, setDailyBatchEnabled] = useState(true);
  const [batchDate, setBatchDate] = useState(() => beirutTodayIso());
  const [batchNumber, setBatchNumber] = useState(1);

  const [assignFilter, setAssignFilter] = useState<"all" | "unassigned" | string>("all");
  const [trustMin, setTrustMin] = useState("");
  const [trustMax, setTrustMax] = useState("");
  const [urgencyMin, setUrgencyMin] = useState("");
  const [urgencyMax, setUrgencyMax] = useState("");
  const [queueFrom, setQueueFrom] = useState("");
  const [queueTo, setQueueTo] = useState("");
  const [hasFlags, setHasFlags] = useState(false);
  const [needs, setNeeds] = useState<string[]>([]);
  const [referenceResult, setReferenceResult] = useState<ReferenceResultFilter | "all">("all");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<DbStatus>("reviewing");
  const [bulkTagId, setBulkTagId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);

  const filters: SubmissionFilters = useMemo(
    () => ({
      search: debouncedQ,
      status: status === "all" ? undefined : status,
      risk_level: risk === "all" ? undefined : risk,
      urgency_tier: tier === "all" ? undefined : tier,
      governorate: governorate === "all" ? undefined : governorate,
      tag_ids: tagIds.length > 0 ? tagIds : undefined,
      needs: needs.length > 0 ? needs : undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
      assigned_to:
        assignFilter !== "all" && assignFilter !== "unassigned" ? assignFilter : undefined,
      unassigned_only: assignFilter === "unassigned" ? true : undefined,
      trust_min: trustMin !== "" ? Number(trustMin) : undefined,
      trust_max: trustMax !== "" ? Number(trustMax) : undefined,
      urgency_min: urgencyMin !== "" ? Number(urgencyMin) : undefined,
      urgency_max: urgencyMax !== "" ? Number(urgencyMax) : undefined,
      queue_from: queueFrom !== "" ? Number(queueFrom) : undefined,
      queue_to: queueTo !== "" ? Number(queueTo) : undefined,
      has_flags: hasFlags || undefined,
      reference_result: referenceResult === "all" ? undefined : referenceResult,
    }),
    [
      debouncedQ,
      status,
      risk,
      tier,
      governorate,
      tagIds,
      needs,
      createdFrom,
      createdTo,
      assignFilter,
      trustMin,
      trustMax,
      urgencyMin,
      urgencyMax,
      queueFrom,
      queueTo,
      hasFlags,
      referenceResult,
    ],
  );

  useEffect(() => {
    if (search.q) setQ(search.q);
  }, [search.q]);

  useEffect(() => {
    if (search.status) setStatus(search.status as DbStatus | "all");
    if (search.tier) setTier(search.tier as UrgencyTier | "all");
    if (search.risk) setRisk(search.risk as typeof risk);
    if (search.urgency_min) setUrgencyMin(search.urgency_min);
    if (search.flags === "1") setHasFlags(true);
  }, [search.status, search.tier, search.risk, search.urgency_min, search.flags]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const staffNames = useMemo(() => staffMapById(staff), [staff]);

  const batchQuery = useDailyBatchSubmissions(batchDate, batchNumber);
  const listQuery = useSubmissionsList(filters, sort, pageSize);
  const { rows: listRows, totalCount: listTotalCount, filesByRequest: listFilesByRequest } =
    useSubmissionsListDerived(listQuery);

  const rows = dailyBatchEnabled ? (batchQuery.data?.rows ?? []) : listRows;
  const totalCount = dailyBatchEnabled ? (batchQuery.data?.totalCount ?? 0) : listTotalCount;
  const filesByRequest = dailyBatchEnabled ? (batchQuery.data?.filesByRequest ?? {}) : listFilesByRequest;
  const loading = dailyBatchEnabled ? batchQuery.isLoading : listQuery.isLoading;
  const loadingMore = dailyBatchEnabled ? false : listQuery.isFetchingNextPage;
  const loadError = dailyBatchEnabled
    ? batchQuery.error instanceof Error
      ? batchQuery.error.message
      : batchQuery.error
        ? "تعذّر تحميل الطلبات"
        : null
    : listQuery.error instanceof Error
      ? listQuery.error.message
      : listQuery.error
        ? "تعذّر تحميل الطلبات"
        : null;
  const hasNextPage = dailyBatchEnabled ? false : listQuery.hasNextPage;
  const batchCount = totalBatches(totalCount);

  useAdminQueryRealtime("admin-requests", "aid_requests", [
    [...adminQueryKeys.all, "submissions"],
    [...adminQueryKeys.all, "daily-batch"],
  ]);

  useEffect(() => {
    setBatchNumber(1);
  }, [batchDate]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkMessage(null);
  }, [filters, sort, pageSize, dailyBatchEnabled, batchDate, batchNumber]);

  const activeQuickFilter = useMemo(() => {
    for (const preset of quickFilterPresets(user?.id)) {
      if (
        matchQuickFilter(preset.id, user?.id, {
          filters,
          assignFilter,
          status,
          createdTo,
          urgencyMin,
        })
      ) {
        return preset.id;
      }
    }
    return null;
  }, [user?.id, filters, assignFilter, status, createdTo, urgencyMin]);

  const applyQuickFilter = (id: QuickFilterId) => {
    const preset = quickFilterPresets(user?.id).find((p) => p.id === id);
    if (!preset || (id === "my_review" && !user?.id)) return;
    setCreatedFrom("");
    setCreatedTo(preset.filters.created_to ?? "");
    setUrgencyMin(preset.filters.urgency_min != null ? String(preset.filters.urgency_min) : "");
    setUrgencyMax("");
    setStatus((preset.filters.status as DbStatus | undefined) ?? "all");
    if (preset.filters.assignFilter && preset.filters.assignFilter !== "all") {
      setAssignFilter(preset.filters.assignFilter);
    } else {
      setAssignFilter("all");
    }
  };

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    savePageSize(size);
  };

  const selectedCount = selectedIds.size;
  const pickedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of rows) next.delete(r.id);
      } else {
        for (const r of rows) next.add(r.id);
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkMessage(null);
  };

  const runBulkAction = async (action: () => Promise<{ ok: boolean; message?: string; updated?: number }>) => {
    setBulkBusy(true);
    setBulkMessage(null);
    const result = await action();
    if (!result.ok) {
      setBulkMessage(result.message ?? "تعذّر تنفيذ العملية.");
    } else {
      setSelectedIds(new Set());
      setBulkMessage(`تم تطبيق العملية على ${result.updated ?? pickedRows.length} طلباً.`);
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview() });
      invalidateSubmissionsListQueries(queryClient);
    }
    setBulkBusy(false);
  };

  const handleBulkAssign = () =>
    void runBulkAction(async () => {
      const result = await bulkAssignRequests(pickedRows, bulkReviewerId, displayName);
      return result.ok ? { ok: true, updated: result.updated } : { ok: false, message: result.message };
    });

  const handleBulkStatus = () => {
    if (bulkStatus === "rejected") {
      setBulkRejectOpen(true);
      return;
    }
    void runBulkAction(async () => {
      const result = await bulkUpdateRequestStatus(pickedRows, bulkStatus, displayName);
      return result.ok ? { ok: true, updated: result.updated } : { ok: false, message: result.message };
    });
  };

  const handleBulkReject = async (reason: string) => {
    setBulkRejectOpen(false);
    await runBulkAction(async () => {
      const result = await bulkUpdateRequestStatus(pickedRows, "rejected", displayName, reason);
      return result.ok ? { ok: true, updated: result.updated } : { ok: false, message: result.message };
    });
  };

  const handleBulkTag = () => {
    const tag = allTags.find((t) => t.id === bulkTagId);
    if (!tag) return;
    void runBulkAction(async () => {
      const result = await bulkAddTagToRequests(pickedRows, bulkTagId, tag.name_ar, displayName);
      return result.ok ? { ok: true, updated: result.updated } : { ok: false, message: result.message };
    });
  };

  const handleBulkExportSelected = () => {
    if (!canExport(roles) || pickedRows.length === 0) return;
    setBulkBusy(true);
    setBulkMessage(null);
    void exportSelectedSubmissions({
      rows: pickedRows,
      columns: exportColumns,
      actorName: displayName,
    })
      .then(() => {
        setBulkMessage(`تم تصدير ${pickedRows.length} طلباً.`);
        clearSelection();
      })
      .catch(() => setBulkMessage("تعذّر تصدير الطلبات المحدّدة."))
      .finally(() => setBulkBusy(false));
  };

  const setSort = (field: SortField) => {
    const direction =
      sort.field === field && sort.direction === "desc" ? "asc" : field === "queue_number" ? "asc" : "desc";
    void navigate({
      to: "/admin/requests",
      search: { sort: field, dir: direction },
    });
  };

  const applySavedView = (view: SavedView) => {
    setDailyBatchEnabled(false);
    setQ(view.filters.search ?? "");
    setStatus((view.filters.status as DbStatus | undefined) ?? "all");
    setRisk((view.filters.risk_level as typeof risk) ?? "all");
    setTier((view.filters.urgency_tier as UrgencyTier | undefined) ?? "all");
    setGovernorate(view.filters.governorate ?? "all");
    setTagIds(view.filters.tag_ids ?? []);
    setNeeds(view.filters.needs ?? []);
    setCreatedFrom(view.filters.created_from ?? "");
    setCreatedTo(view.filters.created_to ?? "");
    if (view.filters.unassigned_only) {
      setAssignFilter("unassigned");
    } else if (view.filters.assigned_to) {
      setAssignFilter(view.filters.assigned_to);
    } else {
      setAssignFilter("all");
    }
    setTrustMin(view.filters.trust_min != null ? String(view.filters.trust_min) : "");
    setTrustMax(view.filters.trust_max != null ? String(view.filters.trust_max) : "");
    setUrgencyMin(view.filters.urgency_min != null ? String(view.filters.urgency_min) : "");
    setUrgencyMax(view.filters.urgency_max != null ? String(view.filters.urgency_max) : "");
    setQueueFrom(view.filters.queue_from != null ? String(view.filters.queue_from) : "");
    setQueueTo(view.filters.queue_to != null ? String(view.filters.queue_to) : "");
    setHasFlags(Boolean(view.filters.has_flags));
    setReferenceResult(view.filters.reference_result ?? "all");
    const cols = resolveExportColumns(view.columns);
    saveExportColumns(cols);
    setExportColumns(cols);
    void navigate({
      to: "/admin/requests",
      search: { sort: view.sort.field, dir: view.sort.direction },
    });
  };

  const displayUrgency = (s: Row) => s.effective_urgency ?? s.urgency_score;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-clay/30 bg-clay/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">دفعة اليوم — ٥٠ طلباً (FIFO)</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              اختر يوماً بتوقيت بيروت — تُعرض الطلبات حسب رقم الدور (#1–50، ثم #51–80…). الاستقبال العام يبقى مفتوحاً.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={dailyBatchEnabled}
              onChange={(e) => setDailyBatchEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            وضع الدفعة اليومية
          </label>
        </div>
        {dailyBatchEnabled && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">اليوم (Asia/Beirut)</span>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setBatchDate(beirutTodayIso());
                setBatchNumber(1);
              }}
              className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay"
            >
              اليوم
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={batchNumber <= 1 || loading}
                onClick={() => setBatchNumber((n) => Math.max(1, n - 1))}
                className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-40"
              >
                ← الدفعة السابقة
              </button>
              <span className="font-mono text-xs text-muted-foreground">
                دفعة {batchNumber.toLocaleString("ar-EG")} / {batchCount.toLocaleString("ar-EG")} ·{" "}
                {batchRangeLabel(batchNumber, totalCount)} من {totalCount.toLocaleString("ar-EG")}
              </span>
              <button
                type="button"
                disabled={batchNumber >= batchCount || loading}
                onClick={() => setBatchNumber((n) => n + 1)}
                className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-40"
              >
                الدفعة التالية →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم، الرمز، أو الهاتف"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DbStatus | "all")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">كل الحالات</option>
            {(Object.entries(STATUS_AR) as [DbStatus, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value as typeof risk)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">كل مستويات المخاطرة</option>
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
            <option value="critical">حرجة</option>
            <option value="fraud">احتيال</option>
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">كل مستويات العجلة</option>
            {(Object.entries(TIER_LABELS) as [UrgencyTier, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            title="عدد الصفوف في الصفحة"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / صفحة
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setQ("");
              setStatus("all");
              setRisk("all");
              setTier("all");
              setGovernorate("all");
              setTagIds([]);
              setNeeds([]);
              setCreatedFrom("");
              setCreatedTo("");
              setAssignFilter("all");
              setTrustMin("");
              setTrustMax("");
              setUrgencyMin("");
              setUrgencyMax("");
              setQueueFrom("");
              setQueueTo("");
              setHasFlags(false);
              setReferenceResult("all");
            }}
            className="w-full rounded-md border border-border px-4 py-2 text-sm hover:border-foreground/40 sm:w-auto"
          >
            إعادة تعيين
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickFilterPresets(user?.id).map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={preset.id === "my_review" && !user?.id}
              onClick={() => applyQuickFilter(preset.id)}
              className={[
                "rounded-full border px-3 py-1 text-xs transition",
                activeQuickFilter === preset.id
                  ? "border-clay bg-clay/10 text-clay"
                  : "border-border hover:border-clay/60",
              ].join(" ")}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">المحافظة / القضاء</span>
            <select
              value={governorate}
              onChange={(e) => setGovernorate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">كل المناطق</option>
              {GOVERNORATE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">الاحتياجات</span>
            <select
              multiple
              value={needs}
              onChange={(e) =>
                setNeeds(Array.from(e.target.selectedOptions, (o) => o.value))
              }
              className="h-[72px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {NEEDS_OPTIONS.map((need) => (
                <option key={need} value={need}>
                  {need}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">الوسوم (أيّ من المحدّد)</span>
            <select
              multiple
              value={tagIds}
              onChange={(e) =>
                setTagIds(Array.from(e.target.selectedOptions, (o) => o.value))
              }
              className="h-[72px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {allTags.length === 0 && <option disabled>لا توجد وسوم</option>}
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">من تاريخ</span>
            <div className="flex gap-1">
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                title="اليوم"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setCreatedFrom(today);
                  setCreatedTo(today);
                  if (pageSize < 50) handlePageSizeChange(50);
                }}
                className={[
                  "rounded-md border px-2 py-1 text-xs whitespace-nowrap",
                  createdFrom === new Date().toISOString().slice(0, 10) && createdTo === new Date().toISOString().slice(0, 10)
                    ? "border-clay bg-clay/10 text-clay"
                    : "border-border hover:border-clay",
                ].join(" ")}
              >
                اليوم
              </button>
            </div>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">إلى تاريخ</span>
            <input
              type="date"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">المراجع المعيّن</span>
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">الكل</option>
              <option value="unassigned">غير معيّن فقط</option>
              {staff.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">الثقة (من — إلى)</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={trustMin}
                onChange={(e) => setTrustMin(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="100"
                value={trustMax}
                onChange={(e) => setTrustMax(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
              />
            </div>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">العجلة الفعّالة (من — إلى)</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={urgencyMin}
                onChange={(e) => setUrgencyMin(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="100"
                value={urgencyMax}
                onChange={(e) => setUrgencyMax(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
              />
            </div>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">رقم الدور (من — إلى)</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                placeholder="#"
                value={queueFrom}
                onChange={(e) => setQueueFrom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
              />
              <input
                type="number"
                min={1}
                placeholder="#"
                value={queueTo}
                onChange={(e) => setQueueTo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
              />
            </div>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">حالة المرجع</span>
            <select
              value={referenceResult}
              onChange={(e) => setReferenceResult(e.target.value as ReferenceResultFilter | "all")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">الكل</option>
              {REFERENCE_RESULT_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hasFlags}
              onChange={(e) => setHasFlags(e.target.checked)}
            />
            إشارات احتيال فقط
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SavedViewsDropdown
            filters={filters}
            sort={sort}
            exportColumns={exportColumns}
            isAdmin={roles.includes("admin")}
            onApply={applySavedView}
          />
          {canExport(roles) && (
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="rounded-md border border-border px-3 py-2 text-sm hover:border-clay"
            >
              تصدير CSV
            </button>
          )}
        </div>
        {loadError && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </p>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="sticky top-2 z-20 rounded-xl border border-clay/40 bg-card p-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {selectedCount.toLocaleString("ar-EG")} طلب محدّد
              <span className="mr-2 text-xs font-normal text-muted-foreground">(الصفحة الحالية)</span>
            </span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              إلغاء التحديد
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">تعيين مراجع</span>
              <select
                value={bulkReviewerId}
                onChange={(e) => setBulkReviewerId(e.target.value)}
                disabled={bulkBusy}
                className="block min-w-[10rem] rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">اختر مراجعاً...</option>
                {staff.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={bulkBusy || !bulkReviewerId}
              onClick={handleBulkAssign}
              className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-50"
            >
              تعيين
            </button>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">تغيير الحالة</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as DbStatus)}
                disabled={bulkBusy}
                className="block min-w-[10rem] rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {BULK_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkStatus}
              className={[
                "rounded-md border px-3 py-2 text-xs disabled:opacity-50",
                bulkStatus === "rejected"
                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-border hover:border-clay",
              ].join(" ")}
            >
              تطبيق الحالة
            </button>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">إضافة وسم</span>
              <select
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                disabled={bulkBusy}
                className="block min-w-[10rem] rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">اختر وسم...</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={bulkBusy || !bulkTagId}
              onClick={handleBulkTag}
              className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-50"
            >
              إضافة وسم
            </button>
            {canExport(roles) && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkExportSelected}
                className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-50"
              >
                تصدير المحدّد
              </button>
            )}
            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-clay" />}
          </div>
          {bulkMessage && <p className="mt-2 text-xs text-clay">{bulkMessage}</p>}
        </div>
      )}

      <div className="table-scroll overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <div>{loading ? "جارٍ التحميل..." : `${totalCount.toLocaleString("ar-EG")} نتيجة`}</div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(SORT_FIELD_LABELS) as SortField[]).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setSort(field)}
                className={[
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  sort.field === field
                    ? "border-clay bg-clay/10 text-clay"
                    : "border-border hover:border-foreground/40",
                ].join(" ")}
              >
                {SORT_FIELD_LABELS[field]}
                {sort.field === field ? (sort.direction === "desc" ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>
        </div>
        <AdminDesktopTable>
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-[11px] uppercase text-muted-foreground">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="تحديد كل الصفوف في الصفحة"
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">الاسم / الرمز</th>
                <th className="px-4 py-3 font-medium">المنطقة</th>
                <th className="px-4 py-3 font-medium">المأوى</th>
                <th className="px-4 py-3 font-medium">العائلة</th>
                <th className="px-4 py-3 font-medium">المراجع</th>
                <th className="px-4 py-3 font-medium">الوثائق</th>
                <th className="px-4 py-3 font-medium">الثقة</th>
                <th className="px-4 py-3 font-medium">العجلة</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">الوقت</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const urg = displayUrgency(s);
                const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
                return (
                  <tr
                    key={s.id}
                    className={[
                      "border-b border-border/60 transition hover:bg-surface",
                      s.flags.length ? "border-r-2 border-r-destructive" : "",
                      selectedIds.has(s.id) ? "bg-clay/5" : "",
                    ].join(" ")}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        aria-label={`تحديد ${s.reference_code}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatQueueNumber(s.queue_number ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.full_name}</div>
                      <div dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                        {s.reference_code} · {s.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.governorate}
                      <br />
                      <span className="text-[11px]">{s.town}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.housing_type ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{s.family_size} فرد</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.infants > 0 && `رضّع ${s.infants}`} {s.disabled && "· إعاقة"}{" "}
                        {s.chronic_illness && "· مزمن"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.assigned_to ? (staffNames[s.assigned_to] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={[
                          docStatusLabel(filesByRequest[s.id] ?? []) === "مرفوض"
                            ? "text-destructive"
                            : docStatusLabel(filesByRequest[s.id] ?? []) === "تم التحقق"
                              ? "text-success"
                              : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {docStatusLabel(filesByRequest[s.id] ?? [])}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{s.trust_score}</div>
                      <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-muted">
                        <div
                           className={[
                            "h-full",
                            s.trust_score >= 75
                              ? "bg-success"
                              : s.trust_score >= 50
                                ? "bg-warning"
                                : "bg-destructive",
                          ].join(" ")}
                          style={{ width: `${s.trust_score}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={["font-mono text-xs", urgencyScoreColor(urg)].join(" ")}>
                          {urg}
                        </div>
                        {s.urgency_tier && (
                          <span
                            className={[
                              "rounded-full border px-1.5 py-0.5 text-[9px]",
                              TIER_BADGE_CLASS[tierKey],
                            ].join(" ")}
                          >
                            {TIER_LABELS[tierKey]}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-muted">
                        <div
                          className={["h-full", urgencyBarColor(urg)].join(" ")}
                          style={{ width: `${urg}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-0.5 text-[11px]",
                          statusColor[s.status],
                        ].join(" ")}
                      >
                        {STATUS_AR[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">
                      {timeAgo(s.queued_at ?? s.created_at)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link 
                        to="/admin/requests/$id" 
                        params={{ id: s.id }} 
                        className="inline-flex items-center justify-center rounded-md bg-clay/10 px-3 py-1.5 text-xs font-medium text-clay transition-colors hover:bg-clay/20 active:bg-clay/30"
                      >
                        عرض
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                    لا توجد طلبات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminDesktopTable>

        <AdminMobileList loading={loading} empty={!loading && rows.length === 0} emptyMessage="لا توجد طلبات.">
          {rows.map((s) => {
            const urg = displayUrgency(s);
            const tierKey = (s.urgency_tier ?? "medium") as UrgencyTier;
            return (
              <AdminMobileCard
                key={s.id}
                className={[
                  s.flags.length ? "border-r-2 border-r-destructive" : "",
                  selectedIds.has(s.id) ? "ring-1 ring-clay/40" : "",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleOne(s.id)}
                    aria-label={`تحديد ${s.reference_code}`}
                    className="h-4 w-4"
                  />
                  <span className="text-[10px] text-muted-foreground">تحديد للعمليات الجماعية</span>
                </div>
                <AdminMobileCardHeader
                  title={s.full_name}
                  mono={`${s.reference_code} · ${s.phone}`}
                  badge={
                    <span
                      className={[
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                        statusColor[s.status],
                      ].join(" ")}
                    >
                      {STATUS_AR[s.status]}
                    </span>
                  }
                />
                <AdminMobileCardGrid
                  rows={[
                    { label: "الدور", value: formatQueueNumber(s.queue_number ?? null) },
                    { label: "المنطقة", value: `${s.governorate ?? "—"}${s.town ? ` · ${s.town}` : ""}` },
                    { label: "العائلة", value: `${s.family_size} فرد` },
                    { label: "المراجع", value: s.assigned_to ? (staffNames[s.assigned_to] ?? "—") : "—" },
                    { label: "الثقة", value: s.trust_score },
                    {
                      label: "العجلة",
                      value: (
                        <span className={urgencyScoreColor(urg)}>
                          {urg}
                          {s.urgency_tier ? ` · ${TIER_LABELS[tierKey]}` : ""}
                        </span>
                      ),
                    },
                    { label: "الوثائق", value: docStatusLabel(filesByRequest[s.id] ?? []) },
                    { label: "الوقت", value: timeAgo(s.queued_at ?? s.created_at) },
                  ]}
                />
                <AdminMobileCardActions>
                  <AdminMobileCardLink to="/admin/requests/$id" params={{ id: s.id }}>
                    عرض التفاصيل ←
                  </AdminMobileCardLink>
                </AdminMobileCardActions>
              </AdminMobileCard>
            );
          })}
        </AdminMobileList>
        {hasNextPage && !dailyBatchEnabled && (
          <div className="border-t border-border p-4 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void listQuery.fetchNextPage()}
              className="rounded-md border border-border px-4 py-2 text-sm hover:border-clay disabled:opacity-50"
            >
              {loadingMore ? "جارٍ التحميل..." : "تحميل المزيد"}
            </button>
          </div>
        )}
      </div>

      {showExport && (
        <ExportSubmissionsModal
          filters={filters}
          actorName={displayName}
          initialColumns={exportColumns}
          onClose={() => setShowExport(false)}
        />
      )}

      <AdminActionModal
        open={bulkRejectOpen}
        title="رفض الطلبات المحدّدة"
        description={`سيتم رفض ${selectedCount.toLocaleString("ar-EG")} طلباً مع تسجيل السبب في سجل كل طلب.`}
        preview={[
          {
            label: "عدد الطلبات",
            value: selectedCount.toLocaleString("ar-EG"),
          },
          ...(pickedRows.length <= 5
            ? [
                {
                  label: "الرموز",
                  value: (
                    <span dir="ltr" className="font-mono text-xs">
                      {pickedRows.map((r) => r.reference_code).join(" · ")}
                    </span>
                  ),
                },
              ]
            : [
                {
                  label: "أمثلة",
                  value: (
                    <span dir="ltr" className="font-mono text-xs">
                      {pickedRows
                        .slice(0, 3)
                        .map((r) => r.reference_code)
                        .join(" · ")}{" "}
                      …
                    </span>
                  ),
                },
              ]),
        ]}
        cannedReasons={[
          "معلومات غير مكتملة",
          "وثيقة غير صالحة أو غير واضحة",
          "تكرار طلب",
          "المرجع رفض التأكيد",
          "لا يستوفي شروط المساعدة",
        ]}
        reasonLabel="سبب الرفض"
        reasonPlaceholder="اشرح سبب الرفض للفريق..."
        requireReason
        confirmLabel="رفض المحدّد"
        variant="destructive"
        busy={bulkBusy}
        onClose={() => setBulkRejectOpen(false)}
        onConfirm={async ({ reason }) => {
          await handleBulkReject(reason);
        }}
      />
    </div>
  );
}
