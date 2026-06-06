import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type UrgencyHistoryRow = Database["public"]["Tables"]["urgency_score_history"]["Row"];

export const URGENCY_TRIGGER_LABELS: Record<string, string> = {
  system: "احتساب تلقائي",
  admin_recalc: "إعادة احتساب يدوي",
  field_change: "بعد تعديل بيانات",
};

export function urgencyTriggerLabel(triggeredBy: string): string {
  return URGENCY_TRIGGER_LABELS[triggeredBy] ?? triggeredBy;
}

export async function fetchUrgencyScoreHistory(
  requestId: string,
  limit = 10,
): Promise<UrgencyHistoryRow[]> {
  const { data, error } = await supabase
    .from("urgency_score_history")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export function formatHistoryTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("ar-LB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
