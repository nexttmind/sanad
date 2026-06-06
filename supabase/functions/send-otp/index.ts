import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const DEFAULT_ALLOWED = ["http://localhost:5173", "http://localhost:3000"];
const BASE_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw?.trim()) return DEFAULT_ALLOWED;
  return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  return getAllowedOrigins().includes(origin) ? origin : null;
}

function corsHeadersForRequest(
  req: Request,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return { "Access-Control-Allow-Headers": allowHeaders };
  }

  const allowed = resolveAllowedOrigin(req);
  if (!allowed) return null;

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Origin",
  };
}

function handleCorsPreflight(
  req: Request,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = corsHeadersForRequest(req, allowHeaders);
  if (!headers) return new Response("Forbidden", { status: 403 });
  return new Response("ok", { headers });
}

function jsonWithCors(
  req: Request,
  body: Record<string, unknown>,
  status: number,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Response {
  const headers = corsHeadersForRequest(req, allowHeaders);
  if (!headers) return new Response("Forbidden", { status: 403 });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

const OTP_TTL_MINUTES = 10;
const MAX_SENDS_PER_HOUR = 3;

type SendBody = { phone: string };

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonWithCors(req, { ok: false, message: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return jsonWithCors(req,{ ok: false, message: "إعدادات الخادم غير مكتملة." }, 500);
    }

    const body = (await req.json()) as SendBody;
    const phone = normalizePhone(body.phone);
    if (!phone || phone.length < 8 || phone.length > 15) {
      return jsonWithCors(req,{ ok: false, message: "رقم الهاتف غير صالح." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("[send-otp] rate count:", countError);
      return jsonWithCors(req,{ ok: false, message: "تعذّر إرسال الرمز." }, 500);
    }

    if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
      return jsonWithCors(req,{ ok: false, message: "تجاوزت الحد المسموح — حاول بعد ساعة." }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    await admin
      .from("phone_verifications")
      .delete()
      .eq("phone", phone)
      .is("verified_at", null);

    const { error: insertError } = await admin.from("phone_verifications").insert({
      phone,
      code,
      attempts: 0,
      expires_at: expiresAt,
      ip_hash: ipHash,
    });

    if (insertError) {
      console.error("[send-otp] insert:", insertError);
      return jsonWithCors(req,{ ok: false, message: "تعذّر إنشاء رمز التحقق." }, 500);
    }

    const smsResult = await sendSms(phone, code);
    if (!smsResult.ok) {
      console.error("[send-otp] sms:", smsResult.message);
      return jsonWithCors(req,{ ok: false, message: smsResult.message ?? "تعذّر إرسال الرسالة." }, 502);
    }

    return jsonWithCors(req,
      {
        ok: true,
        expires_in: OTP_TTL_MINUTES * 60,
        ...(smsResult.dev_code ? { dev_code: smsResult.dev_code } : {}),
      },
      200,
    );
  } catch (err) {
    console.error("[send-otp] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "خطأ غير متوقع." }, 500);
  }
});

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) return `961${digits.slice(1)}`;
  return digits;
}

function hashIdentifier(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return `ip_${Math.abs(h)}`;
}

async function sendSms(
  phone: string,
  code: string,
): Promise<{ ok: true; dev_code?: string } | { ok: false; message: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");

  const message = `رمز التحقق من سند: ${code}`;

  if (!accountSid || !authToken || !from) {
    if (Deno.env.get("OTP_DEV_LOG") === "true") {
      console.log(`[send-otp] DEV code for ${phone}: ${code}`);
      return { ok: true, dev_code: code };
    }
    return {
      ok: false,
      message: "مزوّد الرسائل غير مهيّأ — أضف TWILIO_* في Supabase Edge Function secrets.",
    };
  }

  const to = phone.startsWith("+") ? phone : `+${phone}`;
  const params = new URLSearchParams({ To: to, From: from, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[send-otp] Twilio:", res.status, text);
    return { ok: false, message: "تعذّر إرسال الرسالة النصية." };
  }

  return { ok: true };
}

