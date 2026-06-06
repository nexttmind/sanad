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
  amount: number;
  currency?: string;
  method: DonationMethod;
  message?: string | null;
  is_anonymous?: boolean;
  pledged_for_request?: string | null;
  proofFile?: File | null;
};

export async function submitDonation(
  input: SubmitDonationInput,
): Promise<{ reference_code: string; id: string }> {
  if (!input.donor_name.trim() || input.amount <= 0) {
    throw new Error("invalid donation");
  }

  const { data, error } = await supabase
    .from("donations")
    .insert({
      donor_name: input.is_anonymous ? null : input.donor_name.trim(),
      amount: input.amount,
      currency: input.currency ?? "USD",
      method: input.method,
      message: input.message?.trim() || null,
      is_anonymous: input.is_anonymous ?? false,
      pledged_for_request: input.pledged_for_request ?? null,
      status: "pending",
    })
    .select("id, reference_code")
    .single();

  if (error || !data) throw error ?? new Error("insert failed");

  if (input.proofFile) {
    const ext = input.proofFile.name.split(".").pop() || "bin";
    const path = `${data.id}/proof.${ext}`;
    const up = await supabase.storage.from("payment-proofs").upload(path, input.proofFile, {
      contentType: input.proofFile.type,
      upsert: true,
    });
    if (up.error) throw up.error;

    const { error: proofError } = await supabase.from("payment_proofs").insert({
      donation_id: data.id,
      bucket: "payment-proofs",
      storage_path: path,
      claimed_amount: input.amount,
      verified: false,
    });
    if (proofError) throw proofError;
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
