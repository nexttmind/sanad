/**
 * Post-deploy smoke checks: migration RPCs + edge functions.
 * Usage: node scripts/verify-rollout.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  /* no .env */
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

if (!url || !anon) {
  console.error("Missing SUPABASE_URL or publishable key in .env");
  process.exit(1);
}

const headers = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  "Content-Type": "application/json",
};

async function check(label, fn) {
  try {
    const result = await fn();
    console.log(`OK  ${label}:`, JSON.stringify(result));
    return true;
  } catch (err) {
    console.error(`FAIL ${label}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

let ok = 0;
let fail = 0;

if (
  await check("RPC get_submission_status", async () => {
    const res = await fetch(`${url}/rest/v1/rpc/get_submission_status`, {
      method: "POST",
      headers,
      body: "{}",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text}`);
    return JSON.parse(text);
  })
) ok++;
else fail++;

for (const name of ["submission-status", "precheck-aid-submission", "submit-aid-request"]) {
  if (
    await check(`Edge ${name}`, async () => {
      const res = await fetch(`${url}/functions/v1/${name}`, {
        method: "POST",
        headers,
        body: name === "submission-status" ? "{}" : JSON.stringify({ phone: "70123456" }),
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      if (res.status === 404) {
        throw new Error(
          `404 NOT_FOUND at ${url}/functions/v1/${name} — Supabase edge router has no function with this slug. ` +
            `Renaming in Dashboard often does not fix the URL: delete the old function, create a new one named exactly "${name}", Deploy, JWT OFF, then Test in Dashboard.`,
        );
      }
      if (res.status === 401) {
        throw new Error(`401 — turn OFF "Verify JWT" for ${name} in Dashboard`);
      }
      if (res.status >= 500) throw new Error(`${res.status} ${text}`);
      return { status: res.status, body };
    })
  ) ok++;
  else fail++;
}

console.log(`\n${ok} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nIf RPC failed: run migration SQL in Supabase Dashboard first.");
  process.exit(1);
}
