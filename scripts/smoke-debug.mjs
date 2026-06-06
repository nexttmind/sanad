import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(resolve(root, ".env"), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

for (const name of [
  "get_scoring_preview_samples",
  "bulk_recalculate_scores",
  "donation_impact_stats",
  "calculate_scores",
  "check_queue_integrity",
]) {
  const body =
    name === "get_scoring_preview_samples"
      ? { _limit: 3 }
      : name === "calculate_scores"
        ? { _request_id: "00000000-0000-0000-0000-000000000001" }
        : name === "bulk_recalculate_scores"
          ? { _offset: 0, _batch_size: 1 }
          : {};
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  console.log("\n---", name, res.status, "---");
  console.log(await res.text());
}
