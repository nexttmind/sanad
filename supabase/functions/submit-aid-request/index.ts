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

const OTP_VERIFIED_WINDOW_HOURS = 24;

type RequestBody = {
  full_name?: string;
  phone?: string;
  alt_phone?: string | null;
  national_id?: string | null;
  governorate?: string | null;
  district?: string | null;
  town?: string | null;
  current_address?: string | null;
  housing_type?: string | null;
  family_size?: number;
  infants?: number;
  children?: number;
  elderly?: number;
  disabled?: boolean;
  chronic_illness?: boolean;
  pregnant_or_nursing?: boolean;
  displaced?: boolean;
  displacement_date?: string | null;
  origin_town?: string | null;
  needs?: string[];
  needs_other?: string | null;
  notes?: string | null;
  submission_seconds?: number | null;
  user_agent?: string | null;
  device_fingerprint?: string | null;
};

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

    const body = (await req.json()) as RequestBody;
    const fullName = body.full_name?.trim() ?? "";
    const phoneRaw = body.phone?.trim() ?? "";

    if (!fullName || !phoneRaw) {
      return jsonWithCors(req,{ ok: false, message: "يرجى إدخال الاسم ورقم الهاتف." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const phone = normalizePhone(phoneRaw);
    const phoneVerified = await hasRecentPhoneVerification(admin, phone);

    if (!phoneVerified) {
      return jsonWithCors(req,
        { ok: false, message: "يرجى التحقق من رقم الهاتف برمز SMS قبل الإرسال." },
        403,
      );
    }

    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");
    const needs = Array.isArray(body.needs) ? body.needs.filter((n) => typeof n === "string") : [];

    const { data, error } = await admin
      .from("aid_requests")
      .insert({
        full_name: fullName,
        phone: phoneRaw,
        alt_phone: body.alt_phone?.trim() || null,
        national_id: body.national_id?.trim() || null,
        governorate: body.governorate?.trim() || null,
        district: body.district?.trim() || null,
        town: body.town?.trim() || null,
        current_address: body.current_address?.trim() || null,
        housing_type: body.housing_type?.trim() || null,
        family_size: Math.max(1, Number(body.family_size ?? 1)),
        infants: Math.max(0, Number(body.infants ?? 0)),
        children: Math.max(0, Number(body.children ?? 0)),
        elderly: Math.max(0, Number(body.elderly ?? 0)),
        disabled: body.disabled === true,
        chronic_illness: body.chronic_illness === true,
        pregnant_or_nursing: body.pregnant_or_nursing === true,
        displaced: body.displaced === true,
        displacement_date: body.displacement_date || null,
        origin_town: body.origin_town?.trim() || null,
        needs,
        needs_other: body.needs_other?.trim() || null,
        notes: body.notes?.trim() || null,
        status: "submitted",
        trust_score: 50,
        urgency_score: 50,
        risk_level: "medium",
        priority_override: false,
        is_duplicate: false,
        phone_verified: true,
        flags: [],
        submission_seconds:
          body.submission_seconds == null ? null : Math.max(0, Number(body.submission_seconds)),
        user_agent: body.user_agent?.slice(0, 240) || null,
        device_fingerprint: body.device_fingerprint?.slice(0, 128) || null,
        ip_hash: ipHash,
      })
      .select("id, reference_code")
      .single();

    if (error || !data) {
      console.error("[submit-aid-request] insert:", error);
      return jsonWithCors(req,{ ok: false, message: "تعذّر إرسال الطلب." }, 500);
    }

    return jsonWithCors(req,{ ok: true, id: data.id, reference_code: data.reference_code }, 200);
  } catch (err) {
    console.error("[submit-aid-request] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "خطأ غير متوقع." }, 500);
  }
});

async function hasRecentPhoneVerification(
  admin: ReturnType<typeof createClient>,
  phone: string,
): Promise<boolean> {
  const since = new Date(Date.now() - OTP_VERIFIED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("phone_verifications")
    .select("id")
    .eq("phone", phone)
    .not("verified_at", "is", null)
    .gte("verified_at", since)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[submit-aid-request] otp check:", error);
    throw error;
  }

  return data != null;
}

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

