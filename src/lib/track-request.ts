import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueuePosition } from "@/lib/queue";

export type TrackHistoryEntry = {
  to_status: Database["public"]["Enums"]["request_status"];
  changed_at: string;
};

export type TrackQueuePosition = QueuePosition;

export type TrackLookupRow = {
  reference_code: string;
  full_name: string;
  phone_masked: string;
  governorate: string | null;
  district: string | null;
  town: string | null;
  family_size: number;
  status: Database["public"]["Enums"]["request_status"];
  distribution_date: string | null;
  distribution_location: string | null;
  created_at: string;
  updated_at: string;
};

export type TrackLookupResult =
  | { ok: true; track: TrackLookupRow | null; history: TrackHistoryEntry[]; queue: TrackQueuePosition | null }
  | { ok: false; message: string; rateLimited?: boolean };

function parseTrackQueuePosition(data: unknown): TrackQueuePosition | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const queueNumber = Number(row.queue_number);
  const position = Number(row.position_among_pending);
  const pendingTotal = Number(row.pending_total);
  if (!Number.isFinite(queueNumber) || !Number.isFinite(position) || !Number.isFinite(pendingTotal)) {
    return null;
  }
  return {
    queue_number: queueNumber,
    position_among_pending: position,
    pending_total: pendingTotal,
  };
}

/** Rate-limited track lookup via edge function (Step 2.2 — Option A). */
export async function lookupTrackRequest(code: string, phone: string): Promise<TrackLookupResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    message?: string;
    track?: TrackLookupRow | null;
    history?: TrackHistoryEntry[];
    queue?: unknown;
    retry_after_seconds?: number;
  }>("track-request-proxy", {
    body: { code: code.trim(), phone: phone.trim() },
  });

  if (error) {
    if (import.meta.env.DEV) console.error("[Track] proxy invoke failed:", error);
    return { ok: false, message: "تعذّر البحث عن الطلب." };
  }

  if (!data?.ok) {
    const rateLimited =
      typeof data?.message === "string" &&
      (data.message.includes("تجاوزت الحد") || data.retry_after_seconds != null);
    return {
      ok: false,
      message: data?.message ?? "تعذّر البحث عن الطلب.",
      rateLimited,
    };
  }

  return {
    ok: true,
    track: data.track ?? null,
    history: data.history ?? [],
    queue: parseTrackQueuePosition(data.queue),
  };
}

/** Included in lookupTrackRequest — kept for callers that only need history. */
export async function fetchTrackHistory(
  code: string,
  phone: string,
): Promise<TrackHistoryEntry[]> {
  const result = await lookupTrackRequest(code, phone);
  if (!result.ok) return [];
  return result.history;
}
