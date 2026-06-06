import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AidRowExtended } from "@/lib/request-detail-types";

export type SortField =
  | "queue_number"
  | "effective_urgency"
  | "created_at"
  | "trust_score"
  | "urgency_score";

export type SortDirection = "asc" | "desc";

export type SubmissionFilters = {
  search?: string;
  status?: string;
  risk_level?: string;
  urgency_tier?: string;
  governorate?: string;
  tag_ids?: string[];
  needs?: string[];
  created_from?: string;
  created_to?: string;
  assigned_to?: string;
  unassigned_only?: boolean;
  trust_min?: number;
  trust_max?: number;
  urgency_min?: number;
  urgency_max?: number;
  queue_from?: number;
  queue_to?: number;
  has_flags?: boolean;
  reference_result?: "confirmed" | "denied" | "pending";
};

export type ReferenceResultFilter = NonNullable<SubmissionFilters["reference_result"]>;

export const REFERENCE_RESULT_FILTER_OPTIONS: { value: ReferenceResultFilter; label: string }[] = [
  { value: "confirmed", label: "مرجع مؤكّد" },
  { value: "denied", label: "مرجع رفض" },
  { value: "pending", label: "مرجع بانتظار التواصل" },
];

/** Governorate options aligned with the public request form. */
export const GOVERNORATE_OPTIONS = [
  "قضاء صور",
  "قضاء بنت جبيل",
  "قضاء مرجعيون",
  "قضاء النبطية",
  "قضاء حاصبيا",
  "منطقة أخرى",
] as const;

export type FilterTag = {
  id: string;
  name_ar: string;
  color: string;
};

export async function fetchFilterTags(): Promise<FilterTag[]> {
  const { data, error } = await supabase.from("tags").select("id, name_ar, color").order("name_ar");
  if (error) throw error;
  return (data as FilterTag[] | null) ?? [];
}

export type SubmissionSort = {
  field: SortField;
  direction: SortDirection;
};

export type OffsetListCursor = {
  offset: number;
};

export type KeysetListCursor = {
  last_sort_value: string;
  last_id: string;
  last_queue_number?: number;
};

export type ListCursor = OffsetListCursor | KeysetListCursor;

export type SubmissionListResult = {
  rows: AidRowExtended[];
  totalCount: number;
  nextCursor: ListCursor | null;
};

export const DEFAULT_SUBMISSION_SORT: SubmissionSort = {
  field: "effective_urgency",
  direction: "desc",
};

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const PAGE_SIZE_STORAGE_KEY = "sanad-list-page-size";

export function loadSavedPageSize(): PageSize {
  if (typeof localStorage === "undefined") return 50;
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = Number(raw);
    if (PAGE_SIZE_OPTIONS.includes(n as PageSize)) return n as PageSize;
  } catch {
    /* ignore */
  }
  return 50;
}

export function savePageSize(size: PageSize): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
}

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  queue_number: "رقم الدور",
  effective_urgency: "العجلة الفعّالة",
  created_at: "تاريخ التقديم",
  trust_score: "الثقة",
  urgency_score: "العجلة المحسوبة",
};

function isOffsetCursor(cursor: ListCursor): cursor is OffsetListCursor {
  return Object.prototype.hasOwnProperty.call(cursor, 'offset');
}

export function buildFiltersJson(filters: SubmissionFilters): Json {
  const out: Record<string, Json> = {};
  if (filters.search?.trim()) out.search = filters.search.trim();
  if (filters.status && filters.status !== "all") out.status = filters.status;
  if (filters.risk_level && filters.risk_level !== "all") out.risk_level = filters.risk_level;
  if (filters.urgency_tier && filters.urgency_tier !== "all") out.urgency_tier = filters.urgency_tier;
  if (filters.governorate && filters.governorate !== "all") out.governorate = filters.governorate;
  if (filters.created_from) out.created_from = filters.created_from;
  if (filters.created_to) out.created_to = filters.created_to;
  if (filters.tag_ids?.length) out.tag_ids = filters.tag_ids;
  if (filters.needs?.length) out.needs = filters.needs;
  if (filters.assigned_to) out.assigned_to = filters.assigned_to;
  if (filters.unassigned_only) out.unassigned_only = true;
  if (filters.trust_min != null) out.trust_min = filters.trust_min;
  if (filters.trust_max != null) out.trust_max = filters.trust_max;
  if (filters.urgency_min != null) out.urgency_min = filters.urgency_min;
  if (filters.urgency_max != null) out.urgency_max = filters.urgency_max;
  if (filters.queue_from != null) out.queue_from = filters.queue_from;
  if (filters.queue_to != null) out.queue_to = filters.queue_to;
  if (filters.has_flags) out.has_flags = true;
  if (filters.reference_result) out.reference_result = filters.reference_result;
  return out;
}

export function parseSortFromSearch(params: URLSearchParams): SubmissionSort {
  const field = params.get("sort") as SortField | null;
  const direction = params.get("dir") as SortDirection | null;
  const validFields: SortField[] = [
    "queue_number",
    "effective_urgency",
    "created_at",
    "trust_score",
    "urgency_score",
  ];
  return {
    field: field && validFields.includes(field) ? field : DEFAULT_SUBMISSION_SORT.field,
    direction: direction === "asc" || direction === "desc" ? direction : DEFAULT_SUBMISSION_SORT.direction,
  };
}

export async function listSubmissions(
  filters: SubmissionFilters,
  sort: SubmissionSort = DEFAULT_SUBMISSION_SORT,
  cursor: ListCursor | null = null,
  limit = 50,
): Promise<SubmissionListResult> {
  const rpcCursor = cursor
    ? isOffsetCursor(cursor)
      ? { offset: cursor.offset }
      : {
          last_sort_value: cursor.last_sort_value,
          last_id: cursor.last_id,
          last_queue_number: cursor.last_queue_number,
        }
    : null;

  const { data, error } = await supabase.rpc("list_submissions", {
    _filters: buildFiltersJson(filters),
    _sort: { field: sort.field, direction: sort.direction },
    _cursor: rpcCursor,
    _limit: limit,
  });

  if (error) throw error;

  const payload = (data ?? {}) as {
    rows?: AidRowExtended[];
    total_count?: number;
    next_cursor?: {
      offset?: number;
      last_sort_value?: string;
      last_id?: string;
      last_queue_number?: number;
    } | null;
  };

  const { next_cursor: nextCursor } = payload;
  if (!nextCursor) {
    return {
      rows: payload.rows ?? [],
      totalCount: payload.total_count ?? 0,
      nextCursor: null,
    };
  }

  return {
    rows: payload.rows ?? [],
    totalCount: payload.total_count ?? 0,
    nextCursor:
      typeof nextCursor.offset === "number"
        ? { offset: nextCursor.offset }
        : nextCursor.last_sort_value && nextCursor.last_id
        ? {
            last_sort_value: nextCursor.last_sort_value,
            last_id: nextCursor.last_id,
            last_queue_number: nextCursor.last_queue_number,
          }
        : null,
  };
}
