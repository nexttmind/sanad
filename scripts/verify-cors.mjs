/**
 * Verify CORS preflight for production Netlify origin.
 * Usage: node scripts/verify-cors.mjs
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
const origins = [
  "https://sanadd.co",
  "https://www.sanadd.co",
  "https://sanaddd.netlify.app",
  "http://localhost:5173",
];

const functions = [
  "submission-status",
  "precheck-aid-submission",
  "submit-aid-request",
  "track-request-proxy",
  "admin-user-management",
];

let ok = 0;
let fail = 0;

for (const fn of functions) {
  for (const origin of origins) {
    const label = `${fn} ← ${origin}`;
    try {
      const res = await fetch(`${url}/functions/v1/${fn}`, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type,apikey,x-client-info",
        },
      });
      const acao = res.headers.get("access-control-allow-origin");
      if (res.status === 200 && acao === origin) {
        console.log(`OK  ${label}`);
        ok++;
      } else {
        console.error(`FAIL ${label}: status=${res.status} ACAO=${acao ?? "(missing)"}`);
        fail++;
      }
    } catch (err) {
      console.error(`FAIL ${label}:`, err instanceof Error ? err.message : err);
      fail++;
    }
  }
}

console.log(`\n${ok} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`
CORS still blocked. Fix (pick one):

1) IMMEDIATE — Supabase Dashboard → Edge Functions → Secrets:
   ALLOWED_ORIGINS=https://sanadd.co,https://www.sanadd.co,http://localhost:5173,http://localhost:3000,http://localhost:8080

2) REDEPLOY — paste latest index.ts for each function (JWT OFF), or run:
   npm run functions:deploy:precheck-aid-submission
   npm run functions:deploy:submit-aid-request
   npm run functions:deploy:submission-status
   npm run functions:deploy:track-request-proxy
   npm run functions:deploy:admin-users
`);
  process.exit(1);
}
