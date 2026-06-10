import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// --- inlined aid-validation (Dashboard deploy = single file only) ---
function isLebanesePhone(v: string): boolean {
  const s = v.replace(/[\s-]/g, "");
  return /^(?:\+?961|0)?(3|70|71|76|78|79|81)\d{6}$/.test(s);
}

type AidRequestServerBody = {
  full_name?: string;
  phone?: string;
  alt_phone?: string | null;
  needs?: string[];
  family_size?: number;
};

function validateAidRequestServerBody(body: AidRequestServerBody): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.full_name?.trim()) errors.full_name = "يرجى إدخال الاسم.";
  if (!body.phone?.trim()) errors.phone = "يرجى إدخال رقم الهاتف.";
  else if (!isLebanesePhone(body.phone)) {
    errors.phone = "يرجى التحقق — رقم لبناني صحيح يبدأ بـ 03 أو 70 أو 71 أو 76 أو 78 أو 79 أو 81";
  }

  if (body.alt_phone?.trim() && !isLebanesePhone(body.alt_phone)) {
    errors.alt_phone = "يرجى التحقق من صيغة الرقم الثانوي";
  }

  if (!Array.isArray(body.needs) || body.needs.length === 0) {
    errors.needs = "يرجى اختيار حاجة واحدة على الأقل";
  }

  if ((body.family_size ?? 0) < 1) errors.family_size = "يرجى إدخال عدد أفراد العائلة";

  return errors;
}

function hashIdentifier(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return `ip_${Math.abs(h)}`;
}

const DEFAULT_ALLOWED = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sanadd.co",
  "https://www.sanadd.co",
  "https://sanaddd.netlify.app",
];
const BASE_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  const fromEnv = raw?.trim()
    ? raw.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])];
}

function isNetlifySanadOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    const host = hostname.toLowerCase();
    if (host === "sanadd.co" || host === "www.sanadd.co") return true;
    if (host === "sanaddd.netlify.app") return true;
    return /^[\w-]+--sanaddd\.netlify\.app$/.test(host);
  } catch {
    return false;
  }
}

function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  if (getAllowedOrigins().includes(origin) || isNetlifySanadOrigin(origin)) return origin;
  return null;
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
  return new Response("ok", {
    headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
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

type RequestBody = AidRequestServerBody & {
  governorate?: string | null;
  district?: string | null;
  town?: string | null;
  current_address?: string | null;
  housing_type?: string | null;
  infants?: number;
  children?: number;
  elderly?: number;
  disabled?: boolean;
  chronic_illness?: boolean;
  pregnant_or_nursing?: boolean;
  displaced?: boolean;
  displacement_date?: string | null;
  origin_town?: string | null;
  needs_other?: string | null;
  notes?: string | null;
  submission_seconds?: number | null;
  user_agent?: string | null;
  device_fingerprint?: string | null;
};

type EligibilityRow = {
  allowed?: boolean;
  reason?: string | null;
  message_ar?: string | null;
  existing_reference_code?: string | null;
};

const REASON_MESSAGES: Record<string, string> = {
  daily_cap_reached:
    "نعتذر — وصلنا إلى الحد اليومي لاستقبال الطلبات (٥٠ طلباً). سنعود لاستقبال طلبات جديدة غداً. إذا قدّمت طلباً سابقاً، يمكنك متابعته من صفحة التتبّع.",
  phone_already_submitted:
    "سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.",
};

const SUBMIT_IP_LIMIT = 20;
const SUBMIT_PHONE_LIMIT = 5;
const SUBMIT_WINDOW_SECONDS = 3600;

type RateLimitRow = {
  allowed?: boolean;
  retry_after_seconds?: number;
};

async function assertSubmitRateLimits(
  admin: ReturnType<typeof createClient>,
  ipHash: string,
  phoneRaw: string,
): Promise<{ message: string; retryAfterSeconds: number } | null> {
  const checks = [
    { identifier: ipHash, max: SUBMIT_IP_LIMIT },
    { identifier: `phone:${phoneRaw.replace(/[\s-]/g, "")}`, max: SUBMIT_PHONE_LIMIT },
  ];
  let maxRetry = 0;

  for (const check of checks) {
    const { data, error } = await admin.rpc("check_rate_limit", {
      _identifier: check.identifier,
      _action: "aid_submit",
      _max_count: check.max,
      _window_seconds: SUBMIT_WINDOW_SECONDS,
    });
    if (error) {
      console.error("[submit-aid-request] check_rate_limit:", error);
      throw error;
    }
    const row = (data ?? {}) as RateLimitRow;
    if (row.allowed === false) {
      maxRetry = Math.max(maxRetry, Number(row.retry_after_seconds ?? SUBMIT_WINDOW_SECONDS));
    }
  }

  if (maxRetry > 0) {
    return {
      message: "تجاوزت الحد المسموح لمحاولات الإرسال — حاول لاحقاً.",
      retryAfterSeconds: maxRetry,
    };
  }
  return null;
}

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
      return jsonWithCors(req, { ok: false, message: "إعدادات الخادم غير مكتملة." }, 500);
    }

    const body = (await req.json()) as RequestBody;
    const validationErrors = validateAidRequestServerBody(body);
    if (Object.keys(validationErrors).length > 0) {
      return jsonWithCors(req, { ok: false, errors: validationErrors }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const phoneRaw = body.phone!.trim();
    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");

    const rateBlocked = await assertSubmitRateLimits(admin, ipHash, phoneRaw);
    if (rateBlocked) {
      return jsonWithCors(req, {
        ok: false,
        message: rateBlocked.message,
        retry_after_seconds: rateBlocked.retryAfterSeconds,
      }, 429);
    }

    const { data: eligibility, error: eligibilityError } = await admin.rpc(
      "check_submission_eligibility",
      { _phone: phoneRaw },
    );

    if (eligibilityError) {
      console.error("[submit-aid-request] eligibility:", eligibilityError);
      return jsonWithCors(req, { ok: false, message: "تعذّر التحقق من الأهلية." }, 500);
    }

    const row = (eligibility ?? {}) as EligibilityRow;
    if (row.allowed !== true) {
      const reason = row.reason ?? "not_allowed";
      return jsonWithCors(req, {
        ok: false,
        reason,
        message: row.message_ar ?? REASON_MESSAGES[reason] ?? "تعذّر إرسال الطلب.",
        reference_code: row.existing_reference_code ?? undefined,
      }, 409);
    }

    const needs = Array.isArray(body.needs) ? body.needs.filter((n) => typeof n === "string") : [];

    const { data, error } = await admin
      .from("aid_requests")
      .insert({
        full_name: body.full_name!.trim(),
        phone: phoneRaw,
        alt_phone: body.alt_phone?.trim() || null,
        national_id: null,
        document_type: null,
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
        phone_verified: false,
        flags: [],
        submission_seconds:
          body.submission_seconds == null ? null : Math.max(0, Number(body.submission_seconds)),
        user_agent: body.user_agent?.slice(0, 240) || null,
        device_fingerprint: body.device_fingerprint?.slice(0, 128) || null,
        ip_hash: ipHash,
      })
      .select("id, reference_code")
      .single();

    if (error) {
      console.error("[submit-aid-request] insert:", error);
      if (error.code === "23505") {
        const constraint = String(error.message ?? "");
        if (constraint.includes("phone_normalized")) {
          return jsonWithCors(req, {
            ok: false,
            reason: "phone_already_submitted",
            message: REASON_MESSAGES.phone_already_submitted,
          }, 409);
        }
      }
      if (String(error.message ?? "").includes("daily_cap_reached")) {
        return jsonWithCors(req, {
          ok: false,
          reason: "daily_cap_reached",
          message: REASON_MESSAGES.daily_cap_reached,
        }, 409);
      }
      return jsonWithCors(req, { ok: false, message: "تعذّر إرسال الطلب." }, 500);
    }

    if (!data) {
      return jsonWithCors(req, { ok: false, message: "تعذّر إرسال الطلب." }, 500);
    }

    return jsonWithCors(req, { ok: true, id: data.id, reference_code: data.reference_code }, 200);
  } catch (err) {
    console.error("[submit-aid-request] unexpected:", err);
    return jsonWithCors(req, { ok: false, message: "خطأ غير متوقع." }, 500);
  }
});
