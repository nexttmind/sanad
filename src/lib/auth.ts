import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_PRIORITY: Record<AppRole, number> = {
  admin: 4,
  reviewer: 3,
  distributor: 2,
  viewer: 1,
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير",
  reviewer: "مراجع",
  distributor: "موزّع",
  viewer: "مشاهد",
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}

export function pickPrimaryRole(roles: AppRole[]): AppRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((best, role) =>
    ROLE_PRIORITY[role] > ROLE_PRIORITY[best] ? role : best,
  );
}

export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  if (fullName.trim()) return fullName.trim();
  if (user.email) return user.email.split("@")[0] ?? "مستخدم";
  return "مستخدم";
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
  if (parts[0]) return parts[0].slice(0, 2);
  return "؟؟";
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await (supabase as SupabaseClient)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []).map((row) => row.role as AppRole);
}

export async function checkIsStaff(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Bootstrap the first admin when no user_roles rows exist yet.
 * Call only immediately after sign-in when is_staff is false.
 * Requires an authenticated session (JWT). Returns true if this user became admin.
 */
export async function claimFirstAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_first_admin");
  if (error) throw error;
  return Boolean(data);
}

/** Only allow internal admin paths to prevent open redirects after login. */
export function safeAdminRedirect(path?: string): string {
  if (path && path.startsWith("/admin")) return path;
  return "/admin";
}
