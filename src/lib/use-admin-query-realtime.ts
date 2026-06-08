import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  useAdminMultiRealtime,
  useAdminTableRealtime,
  type RealtimeTable,
} from "@/lib/use-admin-realtime";

function useInvalidateQueries(queryKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  const keySignature = queryKeys.map((k) => JSON.stringify(k)).join("|");

  return useCallback(() => {
    for (const queryKey of queryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, keySignature, queryKeys]);
}

/** Invalidate React Query caches when postgres_changes fire (throttled via useAdminTableRealtime). */
export function useAdminQueryRealtime(
  channelId: string,
  table: RealtimeTable,
  queryKeys: QueryKey[],
  filter?: string,
  waitMs?: number,
): void {
  const invalidate = useInvalidateQueries(queryKeys);
  useAdminTableRealtime(channelId, table, invalidate, filter, waitMs);
}

export function useAdminMultiQueryRealtime(
  channelId: string,
  specs: { table: RealtimeTable; filter?: string; queryKeys: QueryKey[] }[],
  waitMs?: number,
): void {
  const queryClient = useQueryClient();
  const allKeys = useMemo(() => specs.flatMap((s) => s.queryKeys), [specs]);
  const keySignature = allKeys.map((k) => JSON.stringify(k)).join("|");

  const invalidate = useCallback(() => {
    for (const queryKey of allKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, keySignature, allKeys]);

  const realtimeSpecs = useMemo(
    () => specs.map(({ table, filter }) => ({ table, filter })),
    [specs],
  );

  useAdminMultiRealtime(channelId, realtimeSpecs, invalidate, waitMs);
}
