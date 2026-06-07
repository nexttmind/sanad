import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DocumentType } from "@/lib/phone-normalize";

export type AidRequestSubmitPayload = {
  full_name: string;
  phone: string;
  alt_phone?: string | null;
  national_id?: string | null;
  document_type: DocumentType;
  governorate?: string | null;
  district?: string | null;
  town?: string | null;
  current_address?: string | null;
  housing_type?: string | null;
  family_size: number;
  infants: number;
  children: number;
  elderly: number;
  disabled: boolean;
  chronic_illness: boolean;
  pregnant_or_nursing: boolean;
  displaced: boolean;
  displacement_date?: string | null;
  origin_town?: string | null;
  needs: string[];
  needs_other?: string | null;
  notes?: string | null;
  submission_seconds?: number | null;
  user_agent?: string | null;
  device_fingerprint?: string | null;
};

export type SubmitBlockReason =
  | "phone_already_submitted"
  | "id_already_submitted"
  | "daily_cap_reached";

export type AidRequestSubmitResult =
  | { ok: true; id: string; reference_code: string }
  | {
      ok: false;
      message: string;
      reason?: SubmitBlockReason;
      reference_code?: string;
      errors?: Record<string, string>;
    };

/** Server-side aid request insert with ip_hash capture (Step 3.1). */
export async function submitAidRequest(
  payload: AidRequestSubmitPayload,
): Promise<AidRequestSubmitResult> {
  if (!payload.full_name.trim() || !payload.phone.trim()) {
    return { ok: false, message: "invalid request" };
  }

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    message?: string;
    id?: string;
    reference_code?: string;
    reason?: SubmitBlockReason;
    errors?: Record<string, string>;
  }>("submit-aid-request", {
    body: {
      ...payload,
      status: "submitted" satisfies Database["public"]["Enums"]["request_status"],
      trust_score: 50,
      urgency_score: 50,
      risk_level: "medium" satisfies Database["public"]["Enums"]["risk_level"],
      priority_override: false,
      is_duplicate: false,
      flags: [] as string[],
    },
  });

  if (error) {
    if (import.meta.env.DEV) console.error("[SubmitAidRequest] proxy invoke failed:", error);
    return { ok: false, message: "تعذّر إرسال الطلب." };
  }

  if (data?.errors && Object.keys(data.errors).length > 0) {
    const first = Object.values(data.errors)[0];
    return { ok: false, message: first ?? "يرجى التحقق من الحقول.", errors: data.errors };
  }

  if (!data?.ok || !data.id || !data.reference_code) {
    return {
      ok: false,
      message: data?.message ?? "تعذّر إرسال الطلب.",
      reason: data?.reason,
      reference_code: data?.reference_code,
    };
  }

  return { ok: true, id: data.id, reference_code: data.reference_code };
}
