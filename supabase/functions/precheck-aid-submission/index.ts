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
      reference_code: row.existing_reference_code ?? null,
    }, 200);
  } catch (err) {
    console.error("[precheck-aid-submission] unexpected:", err);
    return jsonWithCors(req, { ok: false, message: "خطأ غير متوقع." }, 500);
  }
});
