import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StaffMember = {
  user_id: string;
  role: Database["public"]["Enums"]["app_role"];
  email: string;
  display_name: string;
};

/** Apply migration 20260605160000_admin_detail_actions.sql */
export async function fetchStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await (supabase as SupabaseClient).rpc("list_staff_members");
  if (error) throw error;
  return (data as StaffMember[] | null) ?? [];
}

export function staffMapById(members: StaffMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of members) map[m.user_id] = m.display_name;
  return map;
}
