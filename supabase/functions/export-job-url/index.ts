import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

// Uses a dedicated Supabase storage bucket for export payloads.
// Ensure a bucket named `export-jobs` exists before deploying this function.

type RequestBody = {
  job_id: string;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonWithCors(req,{ ok: false, message: "Server configuration missing." }, 500);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonWithCors(req,{ ok: false, message: "Unauthorized." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonWithCors(req,{ ok: false, message: "Unauthorized." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as RequestBody;
    const jobId = body.job_id?.trim();

    if (!jobId) {
      return jsonWithCors(req,{ ok: false, message: "Job ID is required." }, 400);
    }

    const { data: statusData, error: statusError } = await callerClient.rpc("get_export_job", {
      _job_id: jobId,
    });

    if (statusError || !statusData) {
      console.error("[export-job-url] get_export_job:", statusError);
      return jsonWithCors(req,{ ok: false, message: "Unable to verify export job." }, 400);
    }

    const status = statusData as Record<string, unknown>;
    if (status.status !== "completed") {
      return jsonWithCors(req,{ ok: false, message: "Export not completed yet.", status: status.status }, 409);
    }

    const existingPath = typeof status.csv_path === "string" ? status.csv_path : "";
    const bucket = "export-jobs";
    const path = existingPath || `exports/${jobId}.csv`;

    if (!existingPath) {
      const { data: csvData, error: csvError } = await callerClient.rpc("fetch_export_job_csv", {
        _job_id: jobId,
      });
      if (csvError || typeof csvData !== "string") {
        console.error("[export-job-url] fetch_export_job_csv:", csvError);
        return jsonWithCors(req,{ ok: false, message: "Unable to load export content." }, 500);
      }

      const uploadResult = await admin.storage.from(bucket).upload(path, new Blob([csvData]), {
        upsert: true,
      });
      if (uploadResult.error) {
        console.error("[export-job-url] storage upload:", uploadResult.error);
        return jsonWithCors(req,{ ok: false, message: "Unable to save export to storage." }, 500);
      }

      const { error: updateError } = await admin.from("export_jobs").update({ csv_path: path }).eq("id", jobId);
      if (updateError) {
        console.error("[export-job-url] update export_jobs csv_path:", updateError);
      }
    }

    const { data: signedData, error: signedError } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);

    if (signedError || !signedData?.signedUrl) {
      console.error("[export-job-url] createSignedUrl:", signedError);
      return jsonWithCors(req,{ ok: false, message: "Unable to create download URL." }, 500);
    }

    return jsonWithCors(req,
      {
        ok: true,
        url: signedData.signedUrl,
        expires_at: signedData.expiresAt,
        path,
      },
      200,
    );
  } catch (err) {
    console.error("[export-job-url] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "Unexpected error." }, 500);
  }
});

