import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-scheduled-secret, apikey, content-type",
};

type RequestBody = Record<string, unknown>;

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
    const scheduledSecret = Deno.env.get("SCHEDULED_FUNCTION_SECRET");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ ok: false, message: "Server configuration missing." }, 500);
    }

    const isScheduledCall = scheduledSecret && req.headers.get("x-scheduled-secret") === scheduledSecret;
    let callerClient = createClient(supabaseUrl, anonKey);

    if (!isScheduledCall) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ ok: false, message: "Unauthorized." }, 401);
      }
      callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await callerClient.auth.getUser();
      if (userError || !userData.user) {
        return json({ ok: false, message: "Unauthorized." }, 401);
      }

      const { data: isAdmin } = await createClient(supabaseUrl, serviceKey).rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });

      if (!isAdmin) {
        return json({ ok: false, message: "Requires admin role." }, 403);
      }
    }

    const { data, error } = await callerClient.rpc("check_queue_integrity");
    if (error) {
      console.error("[queue-integrity-check] RPC error:", error);
      return json({ ok: false, message: "Integrity check failed.", error: error.message }, 500);
    }

    return json({ ok: true, report: data }, 200);
  } catch (err) {
    console.error("[queue-integrity-check] unexpected:", err);
    return json({ ok: false, message: "Unexpected error." }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
