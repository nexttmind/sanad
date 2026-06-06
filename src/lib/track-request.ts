import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TrackHistoryEntry = {
  to_status: Database["public"]["Enums"]["request_status"];
  changed_at: string;
};

/** Apply migration 20260605150000_track_request_history.sql */
export async function fetchTrackHistory(
  code: string,
  phone: string,
): Promise<TrackHistoryEntry[]> {
  const { data, error } = await (supabase as SupabaseClient).rpc(
    "track_request_history",
    { _code: code, _phone: phone },
  );

  if (error) {
    if (import.meta.env.DEV) console.error("[Track] history RPC failed:", error);
    return [];
  }

  return (data as TrackHistoryEntry[] | null) ?? [];
}
