import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { UrgencyTier } from "@/lib/scoring";

type DbStatus = Database["public"]["Enums"]["request_status"];

export type AdminOverviewPendingRow = {
  id: string;
  full_name: string;
  governorate: string | null;
  queue_number: number;
  effective_urgency: number;
  urgency_tier: UrgencyTier | null;
  urgency_score: number;
  status: DbStatus;
};

export type AdminOverviewRecentRow = {
  id: string;
  full_name: string;
  reference_code: string;
  governorate: string | null;
  trust_score: number;
  effective_urgency: number;
  urgency_score: number;
  queue_number: number;
  queued_at: string | null;
  created_at: string;
  status: DbStatus;
};

export type AdminOverviewStats = {
  total: number;
  today_count: number;
  status_counts: Partial<Record<DbStatus, number>>;
  alerts: {
    critical: number;
    pending_queue: number;
    oldest_queue: number | null;
    infants_pending: number;
    disabled_pending: number;
    shelter_pending: number;
    high_risk: number;
    flagged: number;
  };
  top_pending: AdminOverviewPendingRow[];
  recent: AdminOverviewRecentRow[];
  needs_breakdown: [string, number][];
  daily_last_7: number[];
  vulnerable: {
    infants: number;
    disabled: number;
    chronic: number;
    elderly: number;
  };
};

export async function fetchAdminOverviewStats(): Promise<AdminOverviewStats | null> {
  const { data, error } = await supabase.rpc("get_admin_overview_stats");
  if (error) {
    if (import.meta.env.DEV) console.error("[AdminOverview]", error);
    return null;
  }
  return data as AdminOverviewStats;
}
