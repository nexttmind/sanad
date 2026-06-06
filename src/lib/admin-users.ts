import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { roleLabel, type AppRole } from "@/lib/auth";

export type AdminUserRow = {
  user_id: string;
  email: string;
  display_name: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "reviewer", "distributor", "viewer"];

export function formatLastSignIn(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  if (diff < 86400 * 7) return `قبل ${Math.floor(diff / 86400)} ي`;
  return new Date(iso).toLocaleString("ar-LB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Apply migration 20260605200000_admin_users.sql */
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await (supabase as SupabaseClient).rpc("list_admin_users");
  if (error) throw error;
  return (data as AdminUserRow[] | null) ?? [];
}

type ManageResponse = { ok: boolean; message?: string; user_id?: string };

async function invokeManage(body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke<ManageResponse>("admin-user-management", { body });
  if (error) {
    if (import.meta.env.DEV) console.error("[AdminUsers]", error);
    const ctx = (error as { context?: { json?: () => Promise<ManageResponse> } }).context;
    if (ctx?.json) {
      try {
        const payload = await ctx.json();
        if (payload?.message) return { ok: false, message: payload.message };
      } catch {
        /* ignore parse errors */
      }
    }
    return { ok: false, message: "تعذّر تنفيذ العملية." };
  }
  if (!data?.ok) {
    return { ok: false, message: data?.message ?? "تعذّر تنفيذ العملية." };
  }
  return { ok: true };
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return invokeManage({
    action: "create",
    email: input.email.trim().toLowerCase(),
    password: input.password,
    full_name: input.full_name.trim(),
    role: input.role,
  });
}

export async function deactivateAdminUser(userId: string) {
  return invokeManage({ action: "deactivate", user_id: userId });
}

export async function activateAdminUser(userId: string) {
  return invokeManage({ action: "activate", user_id: userId });
}

export async function updateAdminUserRole(userId: string, role: AppRole) {
  return invokeManage({ action: "update_role", user_id: userId, role });
}

export { roleLabel };
