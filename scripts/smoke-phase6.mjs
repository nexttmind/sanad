/**
 * Phase 6 production smoke — phone uniqueness + daily cap (no OTP).
 * Creates temporary test rows, verifies rules, then deletes them.
 *
 * Usage: node scripts/smoke-phase6.mjs
 * Optional: PLAYWRIGHT_BASE_URL or NETLIFY_URL for frontend check
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!url || !anon || !serviceKey) {
  console.error("Missing SUPABASE_URL, publishable key, or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const anonHeaders = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  "Content-Type": "application/json",
};

const serviceHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const SMOKE = {
  phone1: "70999101",
  phone2: "70999102",
  phone3: "70999103",
  id1: "99101010",
  id2: "99102020",
  passport3: "RL9910101",
};

let ok = 0;
let fail = 0;
let skip = 0;
const createdIds = [];

function pass(label, detail) {
  ok++;
  console.log(`OK  ${label}${detail ? `: ${detail}` : ""}`);
}

function failCheck(label, detail) {
  fail++;
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

function skipCheck(label, reason) {
  skip++;
  console.log(`SKIP ${label}: ${reason}`);
}

async function edgePost(name, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function basePayload(phone, nationalId, documentType = "lebanese_id") {
  return {
    full_name: "Smoke Test User",
    phone,
    national_id: nationalId,
    document_type: documentType,
    family_size: 3,
    needs: ["طعام"],
    displaced: false,
  };
}

async function cleanup() {
  for (const id of createdIds) {
    await fetch(`${url}/rest/v1/aid_requests?id=eq.${id}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
    });
  }
  const phones = [SMOKE.phone1, SMOKE.phone2, SMOKE.phone3];
  for (const p of phones) {
    await fetch(`${url}/rest/v1/aid_requests?phone=eq.${encodeURIComponent(p)}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
    });
  }
}

async function precheck(phone, nationalId, documentType = "lebanese_id") {
  return edgePost("precheck-aid-submission", {
    phone,
    national_id: nationalId,
    document_type: documentType,
  });
}

async function submit(payload) {
  return edgePost("submit-aid-request", payload);
}

console.log("SANAD Phase 6 smoke —", url.replace("https://", ""));
console.log("Test phones:", SMOKE.phone1, SMOKE.phone2, SMOKE.phone3);
console.log("");

// --- 6.0 Rollout infra (reuse verify-rollout) ---
const rollout = spawnSync(process.execPath, [resolve(root, "scripts/verify-rollout.mjs")], {
  cwd: root,
  encoding: "utf8",
});
if (rollout.status === 0) pass("6.0 verify:rollout (RPC + edge functions)");
else {
  failCheck("6.0 verify:rollout", rollout.stdout?.trim() || rollout.stderr?.trim());
}

try {
  await cleanup();

  // --- 6.6b invalid Lebanese ID ---
  {
    const { status, body } = await submit({
      ...basePayload(SMOKE.phone1, "123"),
      national_id: "123",
    });
    if (status === 400 && body?.errors?.national_id) {
      pass("6.6b invalid ID format → 400", body.errors.national_id);
    } else {
      failCheck("6.6b invalid ID format → 400", `${status} ${JSON.stringify(body)}`);
    }
  }

  // --- 6.6c invalid passport ---
  {
    const { status, body } = await submit({
      ...basePayload(SMOKE.phone1, "BADPASS", "passport"),
      document_type: "passport",
      national_id: "BADPASS",
    });
    if (status === 400 && body?.errors?.national_id) {
      pass("6.6c invalid passport format → 400", body.errors.national_id);
    } else {
      failCheck("6.6c invalid passport format → 400", `${status} ${JSON.stringify(body)}`);
    }
  }

  // --- 6.4 first submit OK ---
  let ref1 = null;
  {
    const { status, body } = await submit(basePayload(SMOKE.phone1, SMOKE.id1));
    if (status === 200 && body?.ok === true && body.reference_code) {
      ref1 = body.reference_code;
      if (body.id) createdIds.push(body.id);
      pass("6.4 first submit OK", ref1);
    } else {
      failCheck("6.4 first submit OK", `${status} ${JSON.stringify(body)}`);
    }
  }

  // --- 6.5 duplicate phone (different format) via precheck + submit ---
  {
    const altPhone = "+961 70 999 101";
    const pre = await precheck(altPhone, "99109999");
    if (pre.status === 200 && pre.body?.allowed === false && pre.body?.reason === "phone_already_submitted") {
      pass("6.5 precheck duplicate phone (alt format)", pre.body.reason);
    } else {
      failCheck("6.5 precheck duplicate phone", `${pre.status} ${JSON.stringify(pre.body)}`);
    }

    const sub = await submit(basePayload(altPhone, "99109999"));
    if (sub.status === 409 && sub.body?.reason === "phone_already_submitted") {
      pass("6.5 submit duplicate phone (alt format) → 409", sub.body.reason);
    } else {
      failCheck("6.5 submit duplicate phone", `${sub.status} ${JSON.stringify(sub.body)}`);
    }
  }

  // --- 6.6 duplicate ID (spaces/dashes) ---
  {
    const spacedId = "9910-1010";
    const pre = await precheck(SMOKE.phone2, spacedId);
    if (pre.status === 200 && pre.body?.allowed === false && pre.body?.reason === "id_already_submitted") {
      pass("6.6 precheck duplicate ID (spaced)", pre.body.reason);
    } else {
      failCheck("6.6 precheck duplicate ID", `${pre.status} ${JSON.stringify(pre.body)}`);
    }

    const sub = await submit(basePayload(SMOKE.phone2, spacedId));
    if (sub.status === 409 && sub.body?.reason === "id_already_submitted") {
      pass("6.6 submit duplicate ID (spaced) → 409", sub.body.reason);
    } else {
      failCheck("6.6 submit duplicate ID", `${sub.status} ${JSON.stringify(sub.body)}`);
    }
  }

  // --- 6.7 second distinct phone+ID ---
  {
    const { status, body } = await submit(basePayload(SMOKE.phone2, SMOKE.id2));
    if (status === 200 && body?.ok === true) {
      if (body.id) createdIds.push(body.id);
      pass("6.7 second distinct submit OK", body.reference_code);
    } else {
      failCheck("6.7 second distinct submit", `${status} ${JSON.stringify(body)}`);
    }
  }

  // --- 6.7 third — passport ---
  {
    const { status, body } = await submit(
      basePayload(SMOKE.phone3, SMOKE.passport3, "passport"),
    );
    if (status === 200 && body?.ok === true) {
      if (body.id) createdIds.push(body.id);
      pass("6.7 third submit (passport) OK", body.reference_code);
    } else {
      failCheck("6.7 third submit (passport)", `${status} ${JSON.stringify(body)}`);
    }
  }

  // --- 6.8 track with formatted phone + reference ---
  if (ref1) {
    const { status, body } = await edgePost("track-request-proxy", {
      code: ref1,
      phone: "+961 70 999 101",
    });
    if (status === 200 && body?.ok === true && body?.track) {
      pass("6.8 track with formatted phone + reference", body.track.reference_code ?? "found");
    } else {
      failCheck("6.8 track", `${status} ${JSON.stringify(body)}`);
    }
  } else {
    skipCheck("6.8 track", "no reference from first submit");
  }

  // --- 6.9 cap status (not simulating 50 rows) ---
  {
    const res = await fetch(`${url}/rest/v1/rpc/get_submission_status`, {
      method: "POST",
      headers: anonHeaders,
      body: "{}",
    });
    const body = await res.json();
    if (res.ok && body.accepting === true && typeof body.daily_count === "number") {
      pass("6.9 cap gate open (accepting, count < limit)", `count=${body.daily_count}/${body.daily_limit}`);
    } else if (res.ok && body.accepting === false) {
      pass("6.9 cap gate closed (accepting=false)", body.message_ar ?? "cap reached");
    } else {
      failCheck("6.9 cap status", `${res.status} ${JSON.stringify(body)}`);
    }
  }

  // --- 6.3 frontend loads (optional) ---
  const siteUrl = (
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.NETLIFY_URL ||
    process.env.VITE_SITE_URL ||
    ""
  ).replace(/\/$/, "");

  if (siteUrl) {
    try {
      const res = await fetch(siteUrl, { redirect: "follow" });
      const html = await res.text();
      const hasForm =
        res.ok &&
        (html.includes("precheck") ||
          html.includes("submit-aid") ||
          html.includes("طلب") ||
          html.includes("SANAD") ||
          html.includes("sanad"));
      if (hasForm || res.ok) {
        pass("6.3 production site loads", `${siteUrl} (${res.status})`);
      } else {
        failCheck("6.3 production site loads", `${siteUrl} ${res.status}`);
      }
    } catch (err) {
      failCheck("6.3 production site loads", err instanceof Error ? err.message : String(err));
    }
  } else {
    skipCheck("6.3 production site loads", "set PLAYWRIGHT_BASE_URL or NETLIFY_URL in .env");
  }
} finally {
  await cleanup();
  console.log("\n(cleaned up smoke test rows)");
}

console.log(`\n${ok} passed, ${fail} failed, ${skip} skipped`);
if (fail > 0) process.exit(1);
