import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DonationMethod = Database["public"]["Enums"]["donation_method"];

type RpcImpactStats = {
  week_total_usd?: number | string | null;
  families_helped?: number | string | null;
  last_donation_minutes?: number | string | null;
  requests_received?: number | string | null;
  verify_rate?: number | string | null;
  avg_response_minutes?: number | string | null;
};

type RpcLedgerRow = Database["public"]["Functions"]["public_ledger"]["Returns"][number];
type RpcAdoptableRow = Database["public"]["Functions"]["adoptable_families"]["Returns"][number];
type RpcPledgeRow = Database["public"]["Functions"]["recent_donation_messages"]["Returns"][number];

export type DonationImpactStats = {
  week_total_usd: number;
  families_helped: number;
  last_donation_minutes: number | null;
  requests_received: number;
  verify_rate: number;
  avg_response_minutes: number | null;
};

export type AdoptableFamily = RpcAdoptableRow;

export type LedgerRow = Omit<RpcLedgerRow, "amount" | "message"> & {
  amount: number;
  message: string | null;
};

export type PledgeMessage = RpcPledgeRow;

export const METHOD_UI_TO_DB: Record<string, DonationMethod> = {
  whish: "whish",
  bank: "bank_transfer",
  omt: "omt",
  paypal: "paypal",
};

export const METHOD_LABELS: Record<DonationMethod, string> = {
  whish: "Whish",
  omt: "OMT",
  moneygram: "MoneyGram",
  western_union: "Western Union",
  paypal: "PayPal",
  taptap: "TapTap",
  bank_transfer: "تحويل مصرفي",
  other: "أخرى",
};

export function parseDonationImpactStats(raw: unknown): DonationImpactStats {
  const row = (raw ?? {}) as RpcImpactStats;
  const lastMinutes = row.last_donation_minutes;
  return {
    week_total_usd: Number(row.week_total_usd ?? 0),
    families_helped: Number(row.families_helped ?? 0),
    last_donation_minutes:
      lastMinutes === null || lastMinutes === undefined ? null : Number(lastMinutes),
    requests_received: Number(row.requests_received ?? 0),
    verify_rate: Number(row.verify_rate ?? 0),
    avg_response_minutes:
      row.avg_response_minutes === null || row.avg_response_minutes === undefined
        ? null
        : Number(row.avg_response_minutes),
  };
}

export function normalizeLedgerRow(row: RpcLedgerRow): LedgerRow {
  const beneficiary = row.beneficiary_code?.trim() || null;
  return {
    ...row,
    amount: Number(row.amount),
    message: row.message?.trim() ? row.message.trim() : null,
    beneficiary_code: beneficiary,
  };
}

export function normalizeAdoptableFamily(row: RpcAdoptableRow): AdoptableFamily {
  return {
    ...row,
    raised: Number(row.raised),
    goal: Number(row.goal),
  };
}

export async function fetchDonationImpactStats(): Promise<DonationImpactStats> {
  const { data, error } = await supabase.rpc("donation_impact_stats");
  if (error) throw error;
  return parseDonationImpactStats(data);
}

export async function fetchAdoptableFamilies(limit = 10): Promise<AdoptableFamily[]> {
  const { data, error } = await supabase.rpc("adoptable_families", { _limit: limit });
  if (error) throw error;
  return ((data as RpcAdoptableRow[] | null) ?? []).map(normalizeAdoptableFamily);
}

export async function fetchPublicLedger(limit = 10): Promise<LedgerRow[]> {
  const { data, error } = await supabase.rpc("public_ledger", { _limit: limit });
  if (error) throw error;
  return ((data as RpcLedgerRow[] | null) ?? []).map(normalizeLedgerRow);
}

export async function fetchRecentDonationMessages(limit = 6): Promise<PledgeMessage[]> {
  const { data, error } = await supabase.rpc("recent_donation_messages", { _limit: limit });
  if (error) throw error;
  return (data as PledgeMessage[] | null) ?? [];
}

/** Client-side cache for public read RPCs (Step 8.1 — 60s stale, 5m gc). */
export const publicReadQueryOptions = {
  staleTime: 60_000,
  gcTime: 300_000,
} as const;

export const donationQueryKeys = {
  impactStats: ["donation-impact-stats"] as const,
  publicLedger: (limit: number) => ["public-ledger", limit] as const,
  adoptableFamilies: (limit: number) => ["adoptable-families", limit] as const,
};

export function useDonationImpactStats() {
  return useQuery({
    queryKey: donationQueryKeys.impactStats,
    queryFn: fetchDonationImpactStats,
    ...publicReadQueryOptions,
  });
}

export function usePublicLedger(limit = 10) {
  return useQuery({
    queryKey: donationQueryKeys.publicLedger(limit),
    queryFn: () => fetchPublicLedger(limit),
    ...publicReadQueryOptions,
  });
}

export function useAdoptableFamilies(limit = 10) {
  return useQuery({
    queryKey: donationQueryKeys.adoptableFamilies(limit),
    queryFn: () => fetchAdoptableFamilies(limit),
    ...publicReadQueryOptions,
  });
}

export type DonationProofPhotoRow = {
  id: string;
  asset_key: string;
  label: string;
  sort_order: number;
};

export async function fetchDonationProofPhotos(): Promise<DonationProofPhotoRow[]> {
  const { data, error } = await supabase
    .from("donation_proof_photos")
    .select("id, asset_key, label, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as DonationProofPhotoRow[] | null) ?? [];
}

export type SubmitDonationInput = {
  donor_name: string;
  donor_phone?: string | null;
  amount: number;
  currency?: string;
  method: DonationMethod;
  message?: string | null;
  is_anonymous?: boolean;
  pledged_for_request?: string | null;
  proofFile?: File | null;
};

export class DonationSubmitError extends Error {
  readonly rateLimited: boolean;

  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = "DonationSubmitError";
    this.rateLimited = rateLimited;
  }
}

const MAX_PROOF_BYTES = 4 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_PROOF_BYTES) {
    throw new DonationSubmitError("حجم ملف إثبات الدفع كبير جداً.");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Rate-limited donation pledge via edge function (Step 2.3). */
export async function submitDonation(
  input: SubmitDonationInput,
): Promise<{ reference_code: string; id: string }> {
  if (!input.donor_name.trim() && !input.is_anonymous) {
    throw new DonationSubmitError("invalid donation");
  }
  if (input.amount <= 0) {
    throw new DonationSubmitError("invalid donation");
  }

  let proof_base64: string | undefined;
  let proof_filename: string | undefined;
  let proof_content_type: string | undefined;

  if (input.proofFile) {
    proof_base64 = await fileToBase64(input.proofFile);
    proof_filename = input.proofFile.name;
    proof_content_type = input.proofFile.type || "application/octet-stream";
  }

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    message?: string;
    id?: string;
    reference_code?: string;
    retry_after_seconds?: number;
  }>("submit-donation", {
    body: {
      donor_name: input.donor_name.trim(),
      donor_phone: input.donor_phone?.trim() || null,
      amount: input.amount,
      currency: input.currency ?? "USD",
      method: input.method,
      message: input.message?.trim() || null,
      is_anonymous: input.is_anonymous ?? false,
      pledged_for_request: input.pledged_for_request ?? null,
      proof_base64,
      proof_filename,
      proof_content_type,
    },
  });

  if (error) {
    if (import.meta.env.DEV) console.error("[Donation] proxy invoke failed:", error);
    throw new DonationSubmitError("تعذّر تسجيل التبرّع.");
  }

  if (!data?.ok || !data.reference_code || !data.id) {
    const message = data?.message ?? "تعذّر تسجيل التبرّع.";
    const rateLimited =
      typeof data?.message === "string" &&
      (data.message.includes("تجاوزت الحد") || data.retry_after_seconds != null);
    throw new DonationSubmitError(message, rateLimited);
  }

  return { reference_code: data.reference_code, id: data.id };
}

export function formatLedgerDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-LB", { day: "numeric", month: "short" });
}

/** Arabic label for ledger beneficiary column — family reference or general fund. */
export function formatBeneficiaryLabel(code: string | null | undefined): string {
  if (!code?.trim()) return "صندوق عام";
  return code.trim();
}

export function ledgerItemLabel(row: LedgerRow): string {
  if (row.message?.trim()) return row.message.trim();
  if (row.beneficiary_code) return `دعم عائلة ${row.beneficiary_code}`;
  return METHOD_LABELS[row.method] ?? "تبرّع";
}
