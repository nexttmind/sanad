import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// --- inlined aid-validation (Dashboard deploy = single file only) ---
type DocumentType = "lebanese_id" | "passport";

function normalizeNationalId(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim().replace(/[\s-]/g, "").toUpperCase();
}

function validateDocumentNumberFormat(
  documentType: DocumentType | string | null | undefined,
  raw: string | null | undefined,
): boolean {
  if (!documentType || !raw || !String(raw).trim()) return false;
  if (documentType === "lebanese_id") {
    const digits = String(raw).replace(/\D/g, "");
    return /^\d{7,8}$/.test(digits);
  }
  if (documentType === "passport") {
    const normalized = normalizeNationalId(raw);
    return normalized != null && /^[A-Z]{2}\d{7}$/.test(normalized);
  }
  return false;
}

function isLebanesePhone(v: string): boolean {
  const s = v.replace(/[\s-]/g, "");
  return /^(?:\+?961|0)?(3|70|71|76|78|79|81)\d{6}$/.test(s);
}

const VALIDATION_MESSAGES = {
  invalidLebaneseId: "رقم الهوية يجب أن يكون ٧ أو ٨ أرقام.",
  invalidPassport: "رقم الجواز يجب أن يكون حرفين متبوعين بـ ٧ أرقام (مثال: RL1234567).",
  invalidDocumentType: "يرجى اختيار نوع الوثيقة: بطاقة هوية لبنانية أو جواز سفر.",
} as const;

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

type RequestBody = {
  phone?: string;
  national_id?: string;
  document_type?: string;
};

type EligibilityRow = {
  allowed?: boolean;
  reason?: string | null;
  message_ar?: string | null;
  existing_reference_code?: string | null;
};

function hashIdentifier(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return `ip_${Math.abs(h)}`;
}

const PRECHECK_IP_LIMIT = 120;
const PRECHECK_PHONE_LIMIT = 60;
const PRECHECK_WINDOW_SECONDS = 3600;

type RateLimitRow = {
  allowed?: boolean;
  retry_after_seconds?: number;
};

async function assertPrecheckRateLimits(
  admin: ReturnType<typeof createClient>,
  ipHash: string,
  phoneRaw: string,
): Promise<{ message: string; retryAfterSeconds: number } | null> {
  const checks = [
    { identifier: ipHash, max: PRECHECK_IP_LIMIT },
    { identifier: `phone:${phoneRaw.replace(/[\s-]/g, "")}`, max: PRECHECK_PHONE_LIMIT },
  ];
  let maxRetry = 0;

  for (const check of checks) {
    const { data, error } = await admin.rpc("check_rate_limit", {
      _identifier: check.identifier,
      _action: "aid_precheck",
      _max_count: check.max,
      _window_seconds: PRECHECK_WINDOW_SECONDS,
    });
    if (error) {
      console.error("[precheck-aid-submission] check_rate_limit:", error);
      throw error;
    }
    const row = (data ?? {}) as RateLimitRow;
    if (row.allowed === false) {
      maxRetry = Math.max(maxRetry, Number(row.retry_after_seconds ?? PRECHECK_WINDOW_SECONDS));
    }
  }

  if (maxRetry > 0) {
    return {
      message: "تجاوزت الحد المسموح للتحقق — حاول لاحقاً.",
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
    const phoneRaw = body.phone?.trim() ?? "";

    if (!phoneRaw || !isLebanesePhone(phoneRaw)) {
      return jsonWithCors(req, {
        ok: true,
        allowed: false,
        reason: "invalid_phone",
        message: "يرجى التحقق من رقم الهاتف.",
      }, 200);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");

    const rateBlocked = await assertPrecheckRateLimits(admin, ipHash, phoneRaw);
    if (rateBlocked) {
      return jsonWithCors(req, {
        ok: false,
        message: rateBlocked.message,
        retry_after_seconds: rateBlocked.retryAfterSeconds,
      }, 429);
    }

    const nationalId = body.national_id?.trim();
    const documentType = body.document_type as DocumentType | undefined;

    if (nationalId && documentType) {
      if (documentType !== "lebanese_id" && documentType !== "passport") {
        return jsonWithCors(req, {
          ok: true,
          allowed: false,
          reason: "invalid_document_type",
          message: VALIDATION_MESSAGES.invalidDocumentType,
        }, 200);
      }
      if (!validateDocumentNumberFormat(documentType, nationalId)) {
        return jsonWithCors(req, {
          ok: true,
          allowed: false,
          reason: "invalid_national_id",
          message: documentType === "passport"
            ? VALIDATION_MESSAGES.invalidPassport
            : VALIDATION_MESSAGES.invalidLebaneseId,
        }, 200);
      }
    }

    const { data, error } = await admin.rpc("check_submission_eligibility", {
      _phone: phoneRaw,
      _national_id: nationalId && documentType ? nationalId : null,
    });

    if (error) {
      console.error("[precheck-aid-submission] rpc:", error);
      return jsonWithCors(req, { ok: false, message: "تعذّر التحقق من الأهلية." }, 500);
    }

    const row = (data ?? {}) as EligibilityRow;
    const allowed = row.allowed === true;

    return jsonWithCors(req, {
      ok: true,
      allowed,
      reason: row.reason ?? null,
      message: row.message_ar ?? null,
    }, 200);
  } catch (err) {
    console.error("[precheck-aid-submission] unexpected:", err);
    return jsonWithCors(req, { ok: false, message: "خطأ غير متوقع." }, 500);
  }
});
