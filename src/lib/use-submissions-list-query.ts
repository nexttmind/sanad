import { useInfiniteQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminQueryKeys, adminQueryOptions } from "@/lib/admin-query";
import type { AidRowExtended, FileRowExtended } from "@/lib/request-detail-types";
import {
  buildFiltersJson,
  listSubmissions,
  type ListCursor,
  type PageSize,
  type SubmissionFilters,
  type SubmissionSort,
} from "@/lib/submissions-list";

export type SubmissionsListPage = {
  rows: AidRowExtended[];
  totalCount: number;
  nextCursor: ListCursor | null;
  filesByRequest: Record<string, FileRowExtended[]>;
};

export function submissionsListQueryKey(
  filters: SubmissionFilters,
  sort: SubmissionSort,
  pageSize: PageSize,
) {
  return [
    ...adminQueryKeys.all,
    "submissions",
    buildFiltersJson(filters),
    sort.field,
    sort.direction,
    pageSize,
  ] as const;
}

export function invalidateSubmissionsListQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [...adminQueryKeys.all, "submissions"] });
}

async function fetchFilesForRequests(requestIds: string[]): Promise<Record<string, FileRowExtended[]>> {
  if (requestIds.length === 0) return {};
  const { data } = await supabase
    .from("aid_request_files")
    .select("id, request_id, doc_admin_verified, doc_rejection_reason")
    .in("request_id", requestIds);
  const fileRows = (data as FileRowExtended[] | null) ?? [];
  const byRequest: Record<string, FileRowExtended[]> = {};
  for (const f of fileRows) {
    if (!byRequest[f.request_id]) byRequest[f.request_id] = [];
    byRequest[f.request_id].push(f);
  }
  return byRequest;
}

export function useSubmissionsList(
  filters: SubmissionFilters,
  sort: SubmissionSort,
  pageSize: PageSize,
) {
  return useInfiniteQuery({
    queryKey: submissionsListQueryKey(filters, sort, pageSize),
    queryFn: async ({ pageParam }): Promise<SubmissionsListPage> => {
      const result = await listSubmissions(filters, sort, pageParam as ListCursor | null, pageSize);
      const filesByRequest = await fetchFilesForRequests(result.rows.map((r) => r.id));
      return {
        rows: result.rows,
        totalCount: result.totalCount,
        nextCursor: result.nextCursor,
        filesByRequest,
      };
    },
    initialPageParam: null as ListCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...adminQueryOptions,
  });
}

export function useSubmissionsListDerived(
  query: ReturnType<typeof useSubmissionsList>,
) {
  const rows = useMemo(
    () => query.data?.pages.flatMap((p) => p.rows) ?? [],
    [query.data?.pages],
  );
  const totalCount = query.data?.pages[0]?.totalCount ?? 0;
  const filesByRequest = useMemo(() => {
    const merged: Record<string, FileRowExtended[]> = {};
    for (const page of query.data?.pages ?? []) {
      Object.assign(merged, page.filesByRequest);
    }
    return merged;
  }, [query.data?.pages]);

  return { rows, totalCount, filesByRequest };
}
