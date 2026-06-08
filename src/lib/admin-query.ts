import { useQuery } from "@tanstack/react-query";
import { fetchAdminOverviewStats, type AdminOverviewStats } from "@/lib/admin-overview";
import { fetchStaffMembers } from "@/lib/admin-staff";
import { supabase } from "@/integrations/supabase/client";
import { fetchFilterTags } from "@/lib/submissions-list";

/** Admin lists: 30s stale (realtime invalidates); 5m gc — mirrors public read pattern. */
export const adminQueryOptions = {
  staleTime: 30_000,
  gcTime: 300_000,
} as const;

export const adminQueryKeys = {
  all: ["admin"] as const,
  overview: () => [...adminQueryKeys.all, "overview"] as const,
  staff: () => [...adminQueryKeys.all, "staff"] as const,
  filterTags: () => [...adminQueryKeys.all, "filter-tags"] as const,
  pendingDonationsCount: () => [...adminQueryKeys.all, "pending-donations-count"] as const,
};

export type AdminNavBadgeKey = "requests" | "queue" | "donations";

export type AdminNavBadges = Record<AdminNavBadgeKey, number>;

export function deriveAdminNavBadges(
  stats: AdminOverviewStats | undefined,
  pendingDonations: number,
): AdminNavBadges {
  return {
    requests: stats?.status_counts?.submitted ?? 0,
    queue: stats?.alerts.pending_queue ?? 0,
    donations: pendingDonations,
  };
}

export function deriveAdminAlertCount(stats: AdminOverviewStats | undefined, pendingDonations: number): number {
  if (!stats) return 0;
  return stats.alerts.critical + stats.alerts.flagged + pendingDonations;
}

export async function fetchPendingDonationsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("donations")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export function useAdminOverviewStats() {
  return useQuery({
    queryKey: adminQueryKeys.overview(),
    queryFn: async () => {
      const data = await fetchAdminOverviewStats();
      if (data === null) throw new Error("تعذّر تحميل نظرة عامة الإدارة.");
      return data;
    },
    ...adminQueryOptions,
  });
}

export function useAdminStaff() {
  return useQuery({
    queryKey: adminQueryKeys.staff(),
    queryFn: fetchStaffMembers,
    ...adminQueryOptions,
  });
}

export function useAdminFilterTags() {
  return useQuery({
    queryKey: adminQueryKeys.filterTags(),
    queryFn: fetchFilterTags,
    ...adminQueryOptions,
  });
}

export function useAdminPendingDonationsCount() {
  return useQuery({
    queryKey: adminQueryKeys.pendingDonationsCount(),
    queryFn: fetchPendingDonationsCount,
    ...adminQueryOptions,
  });
}

export function useAdminNavBadges() {
  const overview = useAdminOverviewStats();
  const donations = useAdminPendingDonationsCount();

  const badges = deriveAdminNavBadges(overview.data, donations.data ?? 0);
  const alertCount = deriveAdminAlertCount(overview.data, donations.data ?? 0);
  const alerts = overview.data?.alerts;

  return {
    badges,
    alertCount,
    alerts,
    isLoading: overview.isLoading || donations.isLoading,
  };
}
