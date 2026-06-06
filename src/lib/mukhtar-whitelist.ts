import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const REFERENCE_TYPES = [
  "مختار",
  "شيخ البلد",
  "رجل دين",
  "مسؤول بلدية",
  "طبيب معروف",
  "معلم أو مدير مدرسة",
  "مسؤول جمعية",
  "أخرى",
] as const;

type BaseRow = Database["public"]["Tables"]["mukhtar_whitelist"]["Row"];

export type MukhtarWhitelistRow = BaseRow & {
  village?: string | null;
  reference_type?: string | null;
  is_active?: boolean;
  verified_by?: string | null;
  times_referenced?: number;
  deactivation_reason?: string | null;
  notes?: string | null;
};

export type MukhtarWhitelistInsert = {
  full_name: string;
  phone: string;
  reference_type: string;
  region?: string | null;
  village?: string | null;
  added_by?: string | null;
};

export function isLebPhone(raw: string): boolean {
  const s = raw.replace(/[\s\-()]/g, "");
  return /^(?:\+?961|0)?(3|70|71|76|78|79|81)\d{6}$/.test(s);
}

export async function fetchMukhtarWhitelist(): Promise<MukhtarWhitelistRow[]> {
  const { data, error } = await supabase
    .from("mukhtar_whitelist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as MukhtarWhitelistRow[] | null) ?? [];
}

export async function insertMukhtarWhitelist(row: MukhtarWhitelistInsert): Promise<void> {
  const { error } = await supabase.from("mukhtar_whitelist").insert({
    full_name: row.full_name.trim(),
    phone: row.phone.trim(),
    reference_type: row.reference_type,
    region: row.region?.trim() || null,
    village: row.village?.trim() || null,
    added_by: row.added_by ?? null,
    verified_at: null,
    is_active: true,
  } as never);

  if (error) throw error;
}

export async function verifyMukhtarWhitelist(
  id: string,
  verifiedBy: string,
  notes: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("mukhtar_whitelist")
    .update({
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy,
      notes: notes?.trim() || null,
    } as never)
    .eq("id", id);

  if (error) throw error;
}

export async function deactivateMukhtarWhitelist(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("mukhtar_whitelist")
    .update({
      is_active: false,
      deactivation_reason: reason.trim(),
    } as never)
    .eq("id", id);

  if (error) throw error;
}
