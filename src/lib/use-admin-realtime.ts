import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createThrottledCallback, shouldRefetchWhileVisible } from "@/lib/throttled-callback";

const DEFAULT_THROTTLE_MS = 5_000;

export type RealtimeTable =
  | "aid_requests"
  | "aid_request_notes"
  | "aid_request_history"
  | "aid_request_files"
  | "donations"
  | "user_roles"
  | "mukhtar_whitelist"
  | "distribution_events"
  | "qr_completions";

/**
 * Subscribe to postgres_changes with throttled refetch (avoids refetch storms during submit spikes).
 */
export function useAdminTableRealtime(
  channelId: string,
  table: RealtimeTable,
  refetch: () => void,
  filter?: string,
  waitMs = DEFAULT_THROTTLE_MS,
): void {
  useEffect(() => {
    const throttled = createThrottledCallback(() => {
      if (!shouldRefetchWhileVisible()) return;
      refetch();
    }, waitMs);

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        throttled,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, table, filter, refetch, waitMs]);
}

/**
 * Multiple filtered subscriptions on one channel (e.g. request detail page).
 */
export function useAdminMultiRealtime(
  channelId: string,
  specs: { table: RealtimeTable; filter?: string }[],
  refetch: () => void,
  waitMs = DEFAULT_THROTTLE_MS,
): void {
  const specKey = specs.map((s) => `${s.table}:${s.filter ?? ""}`).join("|");

  useEffect(() => {
    const throttled = createThrottledCallback(() => {
      if (!shouldRefetchWhileVisible()) return;
      refetch();
    }, waitMs);

    let channel = supabase.channel(channelId);
    for (const spec of specs) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: spec.table,
          ...(spec.filter ? { filter: spec.filter } : {}),
        },
        throttled,
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, specKey, refetch, waitMs]);
}
