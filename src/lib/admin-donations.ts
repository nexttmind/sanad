import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/audit-log";
import { METHOD_LABELS } from "@/lib/donations";

export type DonationStatus = Database["public"]["Enums"]["donation_status"];
export type DonationMethod = Database["public"]["Enums"]["donation_method"];

export type AdminDonationRow = {
  id: string;
  reference_code: string;
  donor_name: string | null;
  is_anonymous: boolean;
  amount: number;
  currency: string;
  method: DonationMethod;
  message: string | null;
  status: DonationStatus;
  pledged_for_request: string | null;
  pledged_request_code: string | null;
  internal_notes: string | null;
  created_at: string;
  proof: { id: string; storage_path: string; verified: boolean } | null;
};

export const DONATION_STATUS_AR: Record<DonationStatus, string> = {
  pending: "بانتظار التحقق",
  verified: "موثّق",
  rejected: "مرفوض",
  refunded: "مسترد",
};

export const DONATION_STATUS_COLOR: Record<DonationStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/40",
  verified: "bg-success/15 text-success border-success/40",
  rejected: "bg-destructive/15 text-destructive border-destructive/40",
  refunded: "bg-muted text-muted-foreground border-border",
};

type DonationQueryRow = Database["public"]["Tables"]["donations"]["Row"] & {
  aid_requests: { reference_code: string } | null;
  payment_proofs: { id: string; storage_path: string; verified: boolean }[];
};

function mapRow(row: DonationQueryRow): AdminDonationRow {
  const proof = row.payment_proofs?.[0] ?? null;
  return {
    id: row.id,
    reference_code: row.reference_code,
    donor_name: row.donor_name,
    is_anonymous: row.is_anonymous,
    amount: Number(row.amount),
    currency: row.currency,
    method: row.method,
    message: row.message,
    status: row.status,
    pledged_for_request: row.pledged_for_request,
    pledged_request_code: row.aid_requests?.reference_code ?? null,
    internal_notes: row.internal_notes,
    created_at: row.created_at,
    proof: proof
      ? { id: proof.id, storage_path: proof.storage_path, verified: proof.verified }
      : null,
  };
}

export async function fetchAdminDonations(limit = 200): Promise<AdminDonationRow[]> {
  const { data, error } = await supabase
    .from("donations")
    .select(
      `
      *,
      aid_requests ( reference_code ),
      payment_proofs ( id, storage_path, verified )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data as DonationQueryRow[] | null) ?? []).map(mapRow);
}

export async function getDonationProofUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function verifyDonation(
  row: AdminDonationRow,
  actorName?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("donations")
    .update({ status: "verified" })
    .eq("id", row.id);

  if (error) throw error;

  if (row.proof) {
    await supabase.from("payment_proofs").update({ verified: true }).eq("id", row.proof.id);
  }

  void logAdminAction({
    action: "donation_verified",
    entity: "donation",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: { status: "verified", reference_code: row.reference_code },
    actorName,
  });
}

export async function rejectDonation(
  row: AdminDonationRow,
  reason: string,
  actorName?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("donations")
    .update({
      status: "rejected",
      internal_notes: reason.trim() || null,
    })
    .eq("id", row.id);

  if (error) throw error;

  void logAdminAction({
    action: "donation_rejected",
    entity: "donation",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: {
      status: "rejected",
      reference_code: row.reference_code,
      reason: reason.trim(),
    },
    actorName,
  });
}

export function donorDisplay(row: AdminDonationRow): string {
  if (row.is_anonymous || !row.donor_name) return "متبرّع مجهول";
  return row.donor_name;
}

export function methodLabel(method: DonationMethod): string {
  return METHOD_LABELS[method] ?? method;
}
