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

const DONATION_IP_LIMIT = 10;
const DONATION_PHONE_LIMIT = 5;
const DONATION_WINDOW_SECONDS = 3600;
const MAX_PROOF_BYTES = 4 * 1024 * 1024;

type DonationMethod =
  | "whish"
  | "omt"
  | "moneygram"
  | "western_union"
  | "paypal"
  | "taptap"
  | "bank_transfer"
  | "other";

type RequestBody = {
  donor_name?: string;
  donor_phone?: string | null;
  amount?: number;
  currency?: string;
  method?: DonationMethod;
  message?: string | null;
  is_anonymous?: boolean;
  pledged_for_request?: string | null;
  proof_base64?: string | null;
  proof_filename?: string | null;
  proof_content_type?: string | null;
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
    const donorName = body.donor_name?.trim() ?? "";
    const amount = Number(body.amount ?? 0);
    const method = body.method;
    const isAnonymous = body.is_anonymous === true;

    if (!method || amount <= 0 || (!isAnonymous && !donorName)) {
      return jsonWithCors(req,{ ok: false, message: "بيانات التبرّع غير صالحة." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const ipHash = hashIdentifier(req.headers.get("x-forwarded-for") ?? "unknown");
    const phoneRaw = body.donor_phone?.trim() ?? "";

    const rateBlocked = await assertDonationRateLimits(admin, ipHash, phoneRaw);
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

    const { data: donation, error: insertError } = await admin
      .from("donations")
      .insert({
        donor_name: isAnonymous ? null : donorName,
        donor_phone: phoneRaw || null,
        amount,
        currency: body.currency?.trim() || "USD",
        method,
        message: body.message?.trim() || null,
        is_anonymous: isAnonymous,
        pledged_for_request: body.pledged_for_request ?? null,
        status: "pending",
      })
      .select("id, reference_code")
      .single();

    if (insertError || !donation) {
      console.error("[submit-donation] insert:", insertError);
      return jsonWithCors(req,{ ok: false, message: "تعذّر تسجيل التبرّع." }, 500);
    }

    const proofBase64 = body.proof_base64?.trim();
    if (proofBase64) {
      const proofError = await attachProof(admin, donation.id, amount, proofBase64, {
        filename: body.proof_filename ?? "proof.bin",
        contentType: body.proof_content_type ?? "application/octet-stream",
      });
      if (proofError) {
        console.error("[submit-donation] proof:", proofError);
        return jsonWithCors(req,{ ok: false, message: "تعذّر رفع إثبات الدفع." }, 500);
      }
    }

    return jsonWithCors(req,
      {
        ok: true,
        id: donation.id,
        reference_code: donation.reference_code,
      },
      200,
    );
  } catch (err) {
    console.error("[submit-donation] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "خطأ غير متوقع." }, 500);
  }
});

async function assertDonationRateLimits(
  admin: ReturnType<typeof createClient>,
  ipHash: string,
  phoneRaw: string,
): Promise<{ message: string; retryAfterSeconds: number } | null> {
  const checks: Array<{ identifier: string; max: number }> = [
    { identifier: ipHash, max: DONATION_IP_LIMIT },
  ];

  if (phoneRaw) {
    checks.push({ identifier: `phone:${normalizePhone(phoneRaw)}`, max: DONATION_PHONE_LIMIT });
  }

  let maxRetry = 0;

  for (const check of checks) {
    const { data, error } = await admin.rpc("check_rate_limit", {
      _identifier: check.identifier,
      _action: "donation_pledge",
      _max_count: check.max,
      _window_seconds: DONATION_WINDOW_SECONDS,
    });

    if (error) {
      console.error("[submit-donation] check_rate_limit:", error);
      throw error;
    }

    const row = (data ?? {}) as RateLimitRow;
    if (row.allowed === false) {
      maxRetry = Math.max(maxRetry, Number(row.retry_after_seconds ?? DONATION_WINDOW_SECONDS));
    }
  }

  if (maxRetry > 0) {
    return {
      message: "تجاوزت الحد المسموح لتسجيل التبرّعات — حاول لاحقاً.",
      retryAfterSeconds: maxRetry,
    };
  }

  return null;
}

async function attachProof(
  admin: ReturnType<typeof createClient>,
  donationId: string,
  amount: number,
  proofBase64: string,
  meta: { filename: string; contentType: string },
): Promise<string | null> {
  const bytes = decodeBase64(proofBase64);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROOF_BYTES) {
    return "invalid proof size";
  }

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(meta.contentType)) {
    return "invalid proof type";
  }

  const ext = meta.filename.split(".").pop() || "bin";
  const path = `${donationId}/proof.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, bytes, { contentType: meta.contentType, upsert: true });

  if (uploadError) return uploadError.message;

  const { error: proofError } = await admin.from("payment_proofs").insert({
    donation_id: donationId,
    bucket: "payment-proofs",
    storage_path: path,
    claimed_amount: amount,
    verified: false,
  });

  return proofError?.message ?? null;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

