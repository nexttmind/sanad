import { beirutTodayIso } from "@/lib/daily-batch";
import type { PageSize, ReferenceResultFilter, SortDirection, SortField } from "@/lib/submissions-list";

const STORAGE_KEY = "sanad-admin-requests-list-ui";

export type RequestsListUrlSearch = {
  sort?: string;
  dir?: string;
  q?: string;
  status?: string;
  tier?: string;
  risk?: string;
  urgency_min?: string;
  flags?: string;
};

export type RequestsListUiState = {
  q: string;
  status: string;
  risk: string;
  tier: string;
  governorate: string;
  tagIds: string[];
  createdFrom: string;
  createdTo: string;
  pageSize: PageSize;
  dailyBatchEnabled: boolean;
  batchDate: string;
  batchNumber: number;
  assignFilter: string;
  trustMin: string;
  trustMax: string;
  urgencyMin: string;
  urgencyMax: string;
  queueFrom: string;
  queueTo: string;
  hasFlags: boolean;
  needs: string[];
  referenceResult: ReferenceResultFilter | "all";
  showAdvancedFilters: boolean;
  urlSearch: RequestsListUrlSearch;
  scrollY: number;
  loadedPages: number;
};

export function defaultRequestsListUiState(pageSize: PageSize = 25): RequestsListUiState {
  return {
    q: "",
    status: "all",
    risk: "all",
    tier: "all",
    governorate: "all",
    tagIds: [],
    createdFrom: "",
    createdTo: "",
    pageSize,
    dailyBatchEnabled: true,
    batchDate: beirutTodayIso(),
    batchNumber: 1,
    assignFilter: "all",
    trustMin: "",
    trustMax: "",
    urgencyMin: "",
    urgencyMax: "",
    queueFrom: "",
    queueTo: "",
    hasFlags: false,
    needs: [],
    referenceResult: "all",
    showAdvancedFilters: false,
    urlSearch: {},
    scrollY: 0,
    loadedPages: 1,
  };
}

export function loadRequestsListUiState(pageSize: PageSize = 25): RequestsListUiState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RequestsListUiState>;
    return { ...defaultRequestsListUiState(pageSize), ...parsed, pageSize: parsed.pageSize ?? pageSize };
  } catch {
    return null;
  }
}

export function saveRequestsListUiState(state: RequestsListUiState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode errors
  }
}

export function buildRequestsListUiState(input: {
  q: string;
  status: string;
  risk: string;
  tier: string;
  governorate: string;
  tagIds: string[];
  createdFrom: string;
  createdTo: string;
  pageSize: PageSize;
  dailyBatchEnabled: boolean;
  batchDate: string;
  batchNumber: number;
  assignFilter: string;
  trustMin: string;
  trustMax: string;
  urgencyMin: string;
  urgencyMax: string;
  queueFrom: string;
  queueTo: string;
  hasFlags: boolean;
  needs: string[];
  referenceResult: ReferenceResultFilter | "all";
  showAdvancedFilters: boolean;
  urlSearch: RequestsListUrlSearch;
  scrollY: number;
  loadedPages: number;
}): RequestsListUiState {
  return {
    q: input.q,
    status: input.status,
    risk: input.risk,
    tier: input.tier,
    governorate: input.governorate,
    tagIds: input.tagIds,
    createdFrom: input.createdFrom,
    createdTo: input.createdTo,
    pageSize: input.pageSize,
    dailyBatchEnabled: input.dailyBatchEnabled,
    batchDate: input.batchDate,
    batchNumber: input.batchNumber,
    assignFilter: input.assignFilter,
    trustMin: input.trustMin,
    trustMax: input.trustMax,
    urgencyMin: input.urgencyMin,
    urgencyMax: input.urgencyMax,
    queueFrom: input.queueFrom,
    queueTo: input.queueTo,
    hasFlags: input.hasFlags,
    needs: input.needs,
    referenceResult: input.referenceResult,
    showAdvancedFilters: input.showAdvancedFilters,
    urlSearch: input.urlSearch,
    scrollY: Math.max(0, input.scrollY),
    loadedPages: Math.max(1, input.loadedPages),
  };
}

export function buildRequestsListUrlSearch(search: RequestsListUrlSearch): RequestsListUrlSearch {
  const out: RequestsListUrlSearch = {};
  if (search.sort) out.sort = search.sort;
  if (search.dir) out.dir = search.dir;
  if (search.q) out.q = search.q;
  if (search.status) out.status = search.status;
  if (search.tier) out.tier = search.tier;
  if (search.risk) out.risk = search.risk;
  if (search.urgency_min) out.urgency_min = search.urgency_min;
  if (search.flags === "1") out.flags = "1";
  return out;
}
