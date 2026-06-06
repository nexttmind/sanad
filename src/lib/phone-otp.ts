import { supabase } from "@/integrations/supabase/client";

export type SendOtpResult =
  | { ok: true; expiresIn: number; devCode?: string }
  | { ok: false; message: string };

export type VerifyOtpResult = { ok: true } | { ok: false; message: string };

/** Normalize Lebanese phone to digits-only 961XXXXXXXX for RPC/storage. */
export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) return `961${digits.slice(1)}`;
  return digits;
}

export async function sendPhoneOtp(phone: string): Promise<SendOtpResult> {
  const normalized = normalizePhoneDigits(phone);
  if (normalized.length < 8) {
    return { ok: false, message: "رقم الهاتف غير صالح." };
  }

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    message?: string;
    expires_in?: number;
    dev_code?: string;
  }>("send-otp", { body: { phone: normalized } });

  if (error) {
    if (import.meta.env.DEV) console.error("[OTP] send:", error);
    return { ok: false, message: "تعذّر إرسال رمز التحقق." };
  }

  if (!data?.ok) {
    return { ok: false, message: data?.message ?? "تعذّر إرسال رمز التحقق." };
  }

  return {
    ok: true,
    expiresIn: data.expires_in ?? 600,
    devCode: import.meta.env.DEV ? data.dev_code : undefined,
  };
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const normalized = normalizePhoneDigits(phone);
  const trimmed = code.replace(/\D/g, "");
  if (trimmed.length < 4) {
    return { ok: false, message: "يرجى إدخال الرمز كاملاً." };
  }

  const { data, error } = await supabase.rpc("verify_phone_otp", {
    _phone: normalized,
    _code: trimmed,
  });

  if (error) {
    if (import.meta.env.DEV) console.error("[OTP] verify:", error);
    return { ok: false, message: "تعذّر التحقق من الرمز." };
  }

  if (!data) {
    return { ok: false, message: "الرمز غير صحيح أو منتهٍ — اطلب رمزاً جديداً." };
  }

  return { ok: true };
}

export function otpCooldownLabel(secondsLeft: number): string {
  if (secondsLeft <= 0) return "إعادة الإرسال";
  return `إعادة الإرسال (${secondsLeft}ث)`;
}
