import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PendingStatus = "submitted" | "reviewing" | "verifying" | "on_hold";

export const PENDING_STATUSES: PendingStatus[] = [
  "submitted",
  "reviewing",
  "verifying",
  "on_hold",
];

export type QueuePosition = {
  queue_number: number;
  position_among_pending: number;
  pending_total: number;
};

export function formatQueueNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return `#${String(n).padStart(6, "0")}`;
}

export function formatQueuePosition(position: number, total: number): string {
  return `${position.toLocaleString("ar-EG")} من ${total.toLocaleString("ar-EG")} قيد المعالجة`;
}

export function formatWaitDuration(queuedAt: string | null | undefined): string {
  if (!queuedAt) return "—";
  const diffMs = Date.now() - new Date(queuedAt).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? "يوم" : "أيام"}`;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours} ${hours === 1 ? "ساعة" : "ساعات"}`;
  const mins = Math.floor(diffMs / 60_000);
  return `${Math.max(mins, 1)} د`;
}

export async function fetchQueuePosition(requestId: string): Promise<QueuePosition | null> {
  const { data, error } = await supabase.rpc("queue_position", { _request_id: requestId });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  return {
    queue_number: Number(d.queue_number ?? 0),
    position_among_pending: Number(d.position_among_pending ?? 0),
    pending_total: Number(d.pending_total ?? 0),
  };
}

export function isPendingStatus(
  status: Database["public"]["Enums"]["request_status"],
): boolean {
  return (PENDING_STATUSES as string[]).includes(status);
}
