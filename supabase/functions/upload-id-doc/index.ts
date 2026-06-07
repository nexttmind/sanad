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

const UPLOAD_IP_LIMIT = 5;
const UPLOAD_WINDOW_SECONDS = 3600;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

type RequestBody = {
  request_id?: string;
  file_base64?: string;
  filename?: string;
  content_type?: string;
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
    const requestId = body.request_id?.trim() ?? "";
    const fileBase64 = body.file_base64?.trim() ?? "";
    const filename = body.filename?.trim() || "id.bin";
    const contentType = body.content_type?.trim() || "application/octet-stream";

    if (!requestId || !fileBase64) {
      return jsonWithCors(req,{ ok: false, message: "بيانات الملف غير صالحة." }, 400);
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return jsonWithCors(req,{ ok: false, message: "نوع الملف غير مقبول — JPG أو PNG أو PDF أو WebP فقط." }, 400);
    }

    const bytes = decodeBase64(fileBase64);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
      return jsonWithCors(req,{ ok: false, message: "حجم الملف يجب ألا يتجاوز ٥ ميغابايت." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");

    const rateBlocked = await assertUploadRateLimit(admin, ipHash);
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

    const requestOk = await validateRecentRequest(admin, requestId);
    if (!requestOk) {
      return jsonWithCors(req,{ ok: false, message: "تعذّر ربط الملف بالطلب." }, 403);
    }

    const ext = filename.split(".").pop() || "bin";
    const path = `${requestId}/id.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("id-docs")
      .upload(path, bytes, { contentType, upsert: true });

    if (uploadError) {
      console.error("[upload-id-doc] storage:", uploadError);
      return jsonWithCors(req,{ ok: false, message: "تعذّر رفع الوثيقة." }, 500);
    }

    const { error: fileError } = await admin.from("aid_request_files").insert({
      request_id: requestId,
      kind: "id",
      bucket: "id-docs",
      storage_path: path,
      mime: contentType,
      size_bytes: bytes.byteLength,
    });

    if (fileError) {
      console.error("[upload-id-doc] aid_request_files:", fileError);
      return jsonWithCors(req,{ ok: false, message: "تعذّر تسجيل الوثيقة." }, 500);
    }

    return jsonWithCors(req,{ ok: true, storage_path: path }, 200);
  } catch (err) {
    console.error("[upload-id-doc] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "خطأ غير متوقع." }, 500);
  }
});

async function assertUploadRateLimit(
  admin: ReturnType<typeof createClient>,
  ipHash: string,
): Promise<{ message: string; retryAfterSeconds: number } | null> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    _identifier: ipHash,
    _action: "storage_upload",
    _max_count: UPLOAD_IP_LIMIT,
    _window_seconds: UPLOAD_WINDOW_SECONDS,
  });

  if (error) {
    console.error("[upload-id-doc] check_rate_limit:", error);
    throw error;
  }

  const row = (data ?? {}) as RateLimitRow;
  if (row.allowed === false) {
    return {
      message: "تجاوزت الحد المسموح لرفع الملفات — حاول لاحقاً.",
      retryAfterSeconds: Number(row.retry_after_seconds ?? UPLOAD_WINDOW_SECONDS),
    };
  }

  return null;
}

async function validateRecentRequest(
  admin: ReturnType<typeof createClient>,
  requestId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("aid_requests")
    .select("id")
    .eq("id", requestId)
    .eq("status", "submitted")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .maybeSingle();

  if (error) {
    console.error("[upload-id-doc] request check:", error);
    throw error;
  }

  return data != null;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hashIdentifier(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return `ip_${Math.abs(h)}`;
}

