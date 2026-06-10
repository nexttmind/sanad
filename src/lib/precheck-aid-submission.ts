import { supabase } from "@/integrations/supabase/client";

export type PrecheckReason =
  | "daily_cap_reached"
  | "phone_already_submitted"
  | "invalid_phone";

export type PrecheckResult =
  | { ok: true; allowed: true }
  | {
      ok: true;
      allowed: false;
      reason: PrecheckReason;
      message: string;
    }
  | { ok: false; message: string };

export async function precheckAidSubmission(params: {
  phone: string;
}): Promise<PrecheckResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    allowed?: boolean;
    reason?: PrecheckReason;
    message?: string;
    reference_code?: string | null;
  }>("precheck-aid-submission", { body: params });

  if (error) {
    if (import.meta.env.DEV) console.error("[PrecheckAidSubmission] invoke failed:", error);
    return { ok: false, message: "تعذّر التحقق من الأهلية." };
  }

  if (!data?.ok) {
    return { ok: false, message: "تعذّر التحقق من الأهلية." };
  }

  if (data.allowed) {
    return { ok: true, allowed: true };
  }

  return {
    ok: true,
    allowed: false,
    reason: data.reason ?? "invalid_phone",
    message: data.message ?? "تعذّر إرسال الطلب.",
  };
}
