import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Uses a dedicated Supabase storage bucket for export payloads.
// Ensure a bucket named `export-jobs` exists before deploying this function.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  job_id: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ ok: false, message: "Server configuration missing." }, 500);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, message: "Unauthorized." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, message: "Unauthorized." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as RequestBody;
    const jobId = body.job_id?.trim();

    if (!jobId) {
      return json({ ok: false, message: "Job ID is required." }, 400);
    }

    const { data: statusData, error: statusError } = await callerClient.rpc("get_export_job", {
      _job_id: jobId,
    });

    if (statusError || !statusData) {
      console.error("[export-job-url] get_export_job:", statusError);
      return json({ ok: false, message: "Unable to verify export job." }, 400);
    }

    const status = statusData as Record<string, unknown>;
    if (status.status !== "completed") {
      return json({ ok: false, message: "Export not completed yet.", status: status.status }, 409);
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
        return json({ ok: false, message: "Unable to load export content." }, 500);
      }

      const uploadResult = await admin.storage.from(bucket).upload(path, new Blob([csvData]), {
        upsert: true,
      });
      if (uploadResult.error) {
        console.error("[export-job-url] storage upload:", uploadResult.error);
        return json({ ok: false, message: "Unable to save export to storage." }, 500);
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
      return json({ ok: false, message: "Unable to create download URL." }, 500);
    }

    return json(
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
    return json({ ok: false, message: "Unexpected error." }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
