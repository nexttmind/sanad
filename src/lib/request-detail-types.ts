import type { Database } from "@/integrations/supabase/types";

export type AidRowExtended = Database["public"]["Tables"]["aid_requests"]["Row"];

export type FileRowExtended = Database["public"]["Tables"]["aid_request_files"]["Row"];

export type TagRow = Database["public"]["Tables"]["tags"]["Row"];

export type RequestTagRow = {
  tag_id: string;
  tags: TagRow;
};

export type FraudEventRow = Database["public"]["Tables"]["fraud_events"]["Row"];

export type ContactResult = Database["public"]["Enums"]["reference_contact_result"];

export const CONTACT_RESULT_LABELS: Record<ContactResult, string> = {
  pending: "بانتظار التواصل",
  confirmed: "مؤكّد",
  denied: "رفض",
  unreachable: "لا يمكن الوصول",
  no_answer: "لا يجيب",
  wrong_number: "رقم خاطئ",
};
