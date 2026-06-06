/**
 * Verify scheduled queue-integrity-check invoke (Step 11.1).
 *
 * Usage: npm run cron:verify-integrity
 * Requires in .env:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SCHEDULED_FUNCTION_SECRET (same as edge function secret)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secret = (process.env.SCHEDULED_FUNCTION_SECRET ?? "").trim();
const anonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  console.error("Missing SUPABASE_URL in .env");
  process.exit(1);
}

if (!secret) {
  console.error("Missing SCHEDULED_FUNCTION_SECRET in .env");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "x-scheduled-secret": secret,
};
if (anonKey) {
  headers.apikey = anonKey;
  headers.Authorization = `Bearer ${anonKey}`;
}

const res = await fetch(`${url}/functions/v1/queue-integrity-check`, {
  method: "POST",
  headers,
  body: "{}",
});

const body = await res.json().catch(() => ({}));

if (!res.ok || !body.ok) {
  console.error("Invoke failed:", res.status, body);
  if (body.code === "UNAUTHORIZED_NO_AUTH_HEADER") {
    console.error(
      "\nGateway rejected the call — turn OFF JWT verification for queue-integrity-check in the Dashboard.",
    );
  } else if (body.message === "Unauthorized.") {
    console.error(
      "\nThe function ran but did not accept the scheduled secret.",
      "\nSet Edge Functions → Secrets → SCHEDULED_FUNCTION_SECRET to the exact same value as .env",
      `(local secret length: ${secret.length} chars).`,
      "\nAlso match vault secret scheduled_function_secret if using pg_cron.",
    );
  } else if (body.message === "Invalid scheduled secret.") {
    console.error(
      "\nSecret header was received but does not match Edge Functions → Secrets.",
      `(local secret length: ${secret.length} chars).`,
    );
  }
  process.exit(1);
}

console.log("OK — queue integrity check");
console.log(JSON.stringify(body.report, null, 2));
