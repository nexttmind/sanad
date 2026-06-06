import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Apply migration 20260605130000_submission_references.sql then regenerate types.ts */
export type SubmissionReferenceRow = {
  id: string;
  request_id: string;
  reference_type: string;
  full_name: string;
  phone: string;
  region: string | null;
  village: string | null;
  known_duration: string | null;
  notes: string | null;
  is_whitelisted: boolean;
  whitelist_id: string | null;
  contact_result:
    | "pending"
    | "confirmed"
    | "denied"
    | "unreachable"
    | "no_answer"
    | "wrong_number";
  contacted_at: string | null;
  contact_notes: string | null;
  contacted_by: string | null;
  created_at: string;
};

export type SubmissionReferenceInsert = {
  request_id: string;
  reference_type: string;
  full_name: string;
  phone: string;
  region?: string | null;
  village?: string | null;
  known_duration?: string | null;
  notes?: string | null;
};

export type SubmissionReferenceWithWhitelist = SubmissionReferenceRow & {
  mukhtar_whitelist: {
    id: string;
    full_name: string;
    phone: string;
    region: string | null;
    title: string | null;
    verified_at: string | null;
  } | null;
};

// Table added in migration — cast until types.ts is regenerated.
function referencesTable() {
  return (supabase as SupabaseClient).from("submission_references");
}

export async function insertSubmissionReference(
  row: SubmissionReferenceInsert,
): Promise<void> {
  const { error } = await referencesTable().insert(row);
  if (error) throw error;
}

export async function fetchSubmissionReference(
  requestId: string,
): Promise<SubmissionReferenceWithWhitelist | null> {
  const { data, error } = await referencesTable()
    .select(
      "*, mukhtar_whitelist(id, full_name, phone, region, title, verified_at)",
    )
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) throw error;
  return (data as SubmissionReferenceWithWhitelist | null) ?? null;
}

export async function updateReferenceContact(
  requestId: string,
  contactResult: SubmissionReferenceRow["contact_result"],
  contactNotes: string | null,
  contactedBy: string,
): Promise<void> {
  const { error } = await referencesTable()
    .update({
      contact_result: contactResult,
      contact_notes: contactNotes,
      contacted_at: new Date().toISOString(),
      contacted_by: contactedBy,
    })
    .eq("request_id", requestId);

  if (error) throw error;
}
