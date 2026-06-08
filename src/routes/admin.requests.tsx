import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminTableRealtime } from "@/lib/use-admin-realtime";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { ExportSubmissionsModal } from "@/components/admin/ExportSubmissionsModal";
import { SavedViewsDropdown } from "@/components/admin/SavedViewsDropdown";
import { canExport, loadSavedExportColumns, resolveExportColumns, saveExportColumns, type ExportColumnKey } from "@/lib/export-submissions";
import { fetchStaffMembers, staffMapById, type StaffMember } from "@/lib/admin-staff";
import type { AidRowExtended, FileRowExtended } from "@/lib/request-detail-types";
import { formatQueueNumber } from "@/lib/queue";
import {
  fetchFilterTags,
  GOVERNORATE_OPTIONS,
  listSubmissions,
  loadSavedPageSize,
  PAGE_SIZE_OPTIONS,
  parseSortFromSearch,
  savePageSize,
  SORT_FIELD_LABELS,
  REFERENCE_RESULT_FILTER_OPTIONS,
  type FilterTag,
  type ReferenceResultFilter,
  type ListCursor,
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

const NEEDS_OPTIONS = [
  "طعام",
  "ملابس",
  "أدوية",
  "وسائد وفرش",
  "حفاضات",
  "حليب أطفال",
  "مروحة",
  "غاز",
  "مساعدة مالية",
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

export const Route = createFileRoute("/admin/requests")({
  component: RequestsList,
  validateSearch: (search: Record<string, unknown>) => ({
    sort: typeof search.sort === "string" ? search.sort : undefined,
    dir: typeof search.dir === "string" ? search.dir : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
});

function RequestsList() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { displayName, roles } = useAuth();
  const sort = useMemo(
    () => parseSortFromSearch(new URLSearchParams(search as Record<string, string>)),
    [search],
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<ListCursor | null>(null);
  const [filesByRequest, setFilesByRequest] = useState<Record<string, FileRowExtended[]>>({});
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [allTags, setAllTags] = useState<FilterTag[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>(() => loadSavedPageSize());

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
    void Promise.all([
      fetchFilterTags().then(setAllTags).catch(() => setAllTags([])),
      fetchStaffMembers().then(setStaff).catch(() => setStaff([])),
    ]);
  }, []);

  useEffect(() => {
    if (search.q) setQ(search.q);
  }, [search.q]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadFilesAndStaff = async (requestIds: string[]) => {
    const [filesRes, staff] = await Promise.all([
      requestIds.length
        ? supabase
            .from("aid_request_files")
            .select("id, request_id, doc_admin_verified, doc_rejection_reason")
            .in("request_id", requestIds)
        : Promise.resolve({ data: [] as FileRowExtended[] }),
      fetchStaffMembers().catch(() => []),
    ]);
    const fileRows = (filesRes.data as FileRowExtended[] | null) ?? [];
    const byRequest: Record<string, FileRowExtended[]> = {};
    for (const f of fileRows) {
      if (!byRequest[f.request_id]) byRequest[f.request_id] = [];
      byRequest[f.request_id].push(f);
    }
    setFilesByRequest((prev) => ({ ...prev, ...byRequest }));
    setStaffNames(staffMapById(staff));
  };

  const loadPage = useCallback(
    async (append = false, cursor: ListCursor | null = null) => {
      setLoadError(null);
      try {
        const result = await listSubmissions(filters, sort, cursor, pageSize);
        setRows((prev) => (append ? [...prev, ...result.rows] : result.rows));
        setTotalCount(result.totalCount);
        setNextCursor(result.nextCursor);
        await loadFilesAndStaff(result.rows.map((r) => r.id));
      } catch (err) {
        if (!append) {
          setRows([]);
          setTotalCount(0);
          setNextCursor(null);
        }
        setLoadError(err instanceof Error ? err.message : "تعذّر تحميل الطلبات");
      }
    },
    [filters, sort, pageSize],
  );

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    savePageSize(size);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await loadPage(false, null);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadPage]);

  useAdminTableRealtime("admin-requests", "aid_requests", () => {
    void loadPage(false, null);
  });

  const setSort = (field: SortField) => {
    const direction =
      sort.field === field && sort.direction === "desc" ? "asc" : field === "queue_number" ? "asc" : "desc";
    void navigate({
      to: "/admin/requests",
      search: { sort: field, dir: direction },
    });
  };

  const applySavedView = (view: SavedView) => {
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
            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
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
                    ].join(" ")}
                  >
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
                  <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
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
              <AdminMobileCard key={s.id} className={s.flags.length ? "border-r-2 border-r-destructive" : ""}>
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
        {nextCursor && (
          <div className="border-t border-border p-4 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                void loadPage(true, nextCursor).finally(() => setLoadingMore(false));
              }}
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
    </div>
  );
}
