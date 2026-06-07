import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

type StatusRow = {
  accepting?: boolean;
  daily_count?: number;
  daily_limit?: number;
  message_ar?: string | null;
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonWithCors(req, { ok: false, message: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonWithCors(req, { ok: false, message: "إعدادات الخادم غير مكتملة." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.rpc("get_submission_status");

    if (error) {
      console.error("[submission-status] rpc:", error);
      return jsonWithCors(req, { ok: false, message: "تعذّر تحميل حالة الاستقبال." }, 500);
    }

    const status = (data ?? {}) as StatusRow;
    return jsonWithCors(req, {
      ok: true,
      accepting: status.accepting !== false,
      daily_count: status.daily_count ?? 0,
      daily_limit: status.daily_limit ?? 50,
      message_ar: status.message_ar ?? null,
    }, 200);
  } catch (err) {
    console.error("[submission-status] unexpected:", err);
    return jsonWithCors(req, { ok: false, message: "خطأ غير متوقع." }, 500);
  }
});
