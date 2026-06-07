/**
 * Phase 0 — duplicate audit helper. Without SUPABASE_SERVICE_ROLE_KEY, prints SQL for Dashboard.
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
} catch { /* no .env */ }

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (serviceKey) {
  console.log("[phase0-audit] Service role set — run SQL in md files/phase0-audit-results.md (REST cannot run raw SQL).");
} else {
  console.log("[phase0-audit] No SUPABASE_SERVICE_ROLE_KEY — use Supabase SQL Editor.");
}
console.log("See: md files/phase0-audit-results.md");
