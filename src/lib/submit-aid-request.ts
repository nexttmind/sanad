import { supabase } from "@/integrations/supabase/client";
import { readFunctionInvokeBody } from "@/lib/parse-function-invoke";

export type AidRequestSubmitPayload = {
  full_name: string;
  phone: string;
  alt_phone?: string | null;
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
  form_responses?: Record<string, unknown> | null;
  reference: {
    reference_type: string;
    full_name: string;
    phone: string;
    region?: string | null;
    village?: string | null;
    known_duration?: string | null;
    notes?: string | null;
  };
};

export type SubmitBlockReason =
  | "phone_already_submitted"
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
const SUBMIT_TIMEOUT_MS = 45_000;

export async function submitAidRequest(
  payload: AidRequestSubmitPayload,
): Promise<AidRequestSubmitResult> {
  if (!payload.full_name.trim() || !payload.phone.trim()) {
    return { ok: false, message: "invalid request" };
  }
  if (
    !payload.reference?.reference_type?.trim() ||
    !payload.reference?.full_name?.trim() ||
    !payload.reference?.phone?.trim() ||
    !payload.reference?.region?.trim() ||
    !payload.reference?.known_duration?.trim()
  ) {
    return { ok: false, message: "يرجى إكمال بيانات المرجع قبل الإرسال." };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ data: null, error: new Error("submit timeout") }),
      SUBMIT_TIMEOUT_MS,
    );
  });

  const invokePromise = supabase.functions.invoke<{
    ok?: boolean;
    message?: string;
    id?: string;
    reference_code?: string;
    reason?: SubmitBlockReason;
    errors?: Record<string, string>;
  }>("submit-aid-request", { body: payload });

  const { data, error } = await Promise.race([invokePromise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  if (error?.message === "submit timeout") {
    return {
      ok: false,
      message: "استغرق الطلب وقتاً طويلاً — يرجى المحاولة مرة أخرى بعد دقيقة.",
    };
  }

  const { body, transportFailed } = await readFunctionInvokeBody(data, error);
  if (transportFailed) {
    if (import.meta.env.DEV) console.error("[SubmitAidRequest] proxy invoke failed:", error);
    return { ok: false, message: "تعذّر إرسال الطلب." };
  }

  if (body?.errors && Object.keys(body.errors).length > 0) {
    const first = Object.values(body.errors)[0];
    return {
      ok: false,
      message: body.message ?? first ?? "يرجى التحقق من الحقول.",
      errors: body.errors,
    };
  }

  if (!body?.ok || !body.id || !body.reference_code) {
    return {
      ok: false,
      message: body?.message ?? "تعذّر إرسال الطلب.",
      reason: body?.reason,
      reference_code: body?.reference_code,
    };
  }

  return { ok: true, id: body.id, reference_code: body.reference_code };
}
