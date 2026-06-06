/**
 * Ship-readiness smoke: verify v2 RPCs exist on the live Supabase project.
 * Uses anon key only — staff RPCs should return "not authorized", not "function not found".
 *
 * Usage: node scripts/smoke-ship.mjs
 * Requires SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (or VITE_* variants) in .env
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

async function rpc(name, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function isMissingFunction(data) {
  const msg = JSON.stringify(data).toLowerCase();
  return msg.includes("could not find the function") || msg.includes("pgrst202");
}

const staffRpcs = [
  "list_submissions",
  "export_submissions_csv",
  "create_export_job",
  "get_export_job",
  "advance_export_job",
  "fetch_export_job_csv",
  "queue_position",
  "check_queue_integrity",
  "get_scoring_preview_samples",
  "get_active_scoring_config",
  "bulk_recalculate_scores",
];

const publicRpcs = ["donation_impact_stats", "public_ledger"];

let failed = 0;

console.log("SANAD v2 ship smoke —", url.replace("https://", ""));

for (const name of staffRpcs) {
  let body = {};
  if (name === "queue_position") {
    body = { _request_id: "00000000-0000-0000-0000-000000000001" };
  } else if (
    name === "get_export_job" ||
    name === "advance_export_job" ||
    name === "fetch_export_job_csv"
  ) {
    body = { _job_id: "00000000-0000-0000-0000-000000000001" };
  }
  const { status, data } = await rpc(name, body);
  if (isMissingFunction(data)) {
    console.log(`✗ ${name} — RPC NOT FOUND (apply migration)`);
    failed++;
  } else if (status === 404) {
    console.log(`✗ ${name} — 404 NOT FOUND`);
    failed++;
  } else if (status === 200 || status === 204) {
    console.log(`? ${name} — returned ${status} without staff auth (check RLS)`);
  } else {
    console.log(`✓ ${name} — exists (${status}, auth guard OK)`);
  }
}

for (const name of publicRpcs) {
  const body = name === "public_ledger" ? { _limit: 1 } : {};
  const { status, data } = await rpc(name, body);
  if (isMissingFunction(data)) {
    console.log(`✗ ${name} — RPC NOT FOUND`);
    failed++;
  } else if (status >= 200 && status < 300) {
    console.log(`✓ ${name} — OK (${status})`);
  } else {
    console.log(`? ${name} — ${status}`, typeof data === "object" ? data.message ?? data : data);
  }
}

console.log(failed === 0 ? "\nAll v2 RPCs reachable." : `\n${failed} RPC(s) missing — apply migrations.`);
process.exit(failed === 0 ? 0 : 1);
