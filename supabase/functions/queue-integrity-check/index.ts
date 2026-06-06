import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type IntegrityReport = {
  healthy?: boolean;
  checked_at?: string;
  queue_numbers?: { unique?: boolean; duplicates?: unknown[] };
  sequence?: { ok?: boolean };
  duplicate_phones_pending?: unknown[];
  pending_total?: number;
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
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

    const admin = createClient(supabaseUrl, serviceKey);
    const headerSecret = req.headers.get("x-scheduled-secret");
    const isScheduledCall =
      Boolean(scheduledSecret) && headerSecret === scheduledSecret;
    let rpcClient = admin;

    if (!isScheduledCall) {
      if (headerSecret) {
        return json({ ok: false, message: "Invalid scheduled secret." }, 401);
      }
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ ok: false, message: "Unauthorized." }, 401);
      }

      rpcClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userError } = await rpcClient.auth.getUser();
      if (userError || !userData.user) {
        return json({ ok: false, message: "Unauthorized." }, 401);
      }

      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });

      if (!isAdmin) {
        return json({ ok: false, message: "Requires admin role." }, 403);
      }
    }

    const { data, error } = await rpcClient.rpc("check_queue_integrity");
    if (error) {
      console.error("[queue-integrity-check] RPC error:", error);
      return json({ ok: false, message: "Integrity check failed.", error: error.message }, 500);
    }

    const report = (data ?? {}) as IntegrityReport;

    if (isScheduledCall && report.healthy === false) {
      console.error("[queue-integrity-check] UNHEALTHY queue report:", JSON.stringify(report));
      void admin.from("audit_log").insert({
        actor_id: null,
        action: "queue_integrity_check",
        entity: "queue",
        entity_id: null,
        diff: {
          new_value: {
            healthy: false,
            queue_unique: report.queue_numbers?.unique ?? null,
            sequence_ok: report.sequence?.ok ?? null,
            duplicate_phones: Array.isArray(report.duplicate_phones_pending)
              ? report.duplicate_phones_pending.length
              : 0,
            pending_total: report.pending_total ?? null,
          },
          metadata: {
            source: "scheduled_cron",
            checked_at: report.checked_at ?? new Date().toISOString(),
          },
        },
      });
    }

    return json({ ok: true, report: data }, 200);
  } catch (err) {
    console.error("[queue-integrity-check] unexpected:", err);
    return json({ ok: false, message: "Unexpected error." }, 500);
  }
});
