import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// --- inlined helpers (Dashboard deploy = single file only) ---
function normalizeLebanesePhone(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) return `961${digits.slice(1)}`;
  return `961${digits}`;
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

const TRACK_IP_LIMIT = 30;
const TRACK_PHONE_LIMIT = 10;
const TRACK_WINDOW_SECONDS = 3600;

type RequestBody = {
  code?: string;
  phone?: string;
};

type RateLimitRow = {
  allowed?: boolean;
  retry_after_seconds?: number;
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
    const code = body.code?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";

    if (!code || !phone) {
      return jsonWithCors(req,{ ok: false, message: "يرجى إدخال الرقم المرجعي ورقم الهاتف." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");
    const phoneNormalized = normalizeLebanesePhone(phone) ?? "";

    const rateBlocked = await assertTrackRateLimits(admin, ipHash, phoneNormalized);
    if (rateBlocked) {
      return jsonWithCors(req,
        {
          ok: false,
          message: rateBlocked.message,
          retry_after_seconds: rateBlocked.retryAfterSeconds,
        },
        429,
      );
    }

    const [trackRes, historyRes, queueRes] = await Promise.all([
      admin.rpc("track_request", { _code: code, _phone: phone }),
      admin.rpc("track_request_history", { _code: code, _phone: phone }),
      admin.rpc("track_queue_position", { _code: code, _phone: phone }),
    ]);

    if (trackRes.error) {
      console.error("[track-request-proxy] track_request:", trackRes.error);
      return jsonWithCors(req,{ ok: false, message: "تعذّر البحث عن الطلب." }, 500);
    }

    if (historyRes.error) {
      console.error("[track-request-proxy] track_request_history:", historyRes.error);
      return jsonWithCors(req,{ ok: false, message: "تعذّر تحميل سجل الطلب." }, 500);
    }

    if (queueRes.error) {
      console.error("[track-request-proxy] track_queue_position:", queueRes.error);
      return jsonWithCors(req,{ ok: false, message: "تعذّر تحميل موقع الطلب في القائمة." }, 500);
    }

    const trackRows = Array.isArray(trackRes.data) ? trackRes.data : [];
    return jsonWithCors(req,
      {
        ok: true,
        track: trackRows.length > 0 ? trackRows[0] : null,
        history: Array.isArray(historyRes.data) ? historyRes.data : [],
        queue: queueRes.data ?? null,
      },
      200,
    );
  } catch (err) {
    console.error("[track-request-proxy] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "خطأ غير متوقع." }, 500);
  }
});

async function assertTrackRateLimits(
  admin: ReturnType<typeof createClient>,
  ipHash: string,
  phoneNormalized: string,
): Promise<{ message: string; retryAfterSeconds: number } | null> {
  const checks = [
    {
      identifier: ipHash,
      max: TRACK_IP_LIMIT,
    },
    {
      identifier: `phone:${phoneNormalized}`,
      max: TRACK_PHONE_LIMIT,
    },
  ];

  let maxRetry = 0;

  for (const check of checks) {
    const { data, error } = await admin.rpc("check_rate_limit", {
      _identifier: check.identifier,
      _action: "track_lookup",
      _max_count: check.max,
      _window_seconds: TRACK_WINDOW_SECONDS,
    });

    if (error) {
      console.error("[track-request-proxy] check_rate_limit:", error);
      throw error;
    }

    const row = (data ?? {}) as RateLimitRow;
    if (row.allowed === false) {
      maxRetry = Math.max(maxRetry, Number(row.retry_after_seconds ?? TRACK_WINDOW_SECONDS));
    }
  }

  if (maxRetry > 0) {
    return {
      message: "تجاوزت الحد المسموح لعمليات التتبّع — حاول لاحقاً.",
      retryAfterSeconds: maxRetry,
    };
  }

  return null;
}

