# SANAD — Current Situation

**Last updated:** 2026-06-06  
**Supabase project:** `lpdjtzwfxsjjudhxinmk`  
**Test suite:** 162 Vitest tests passing · production build OK

This document replaces the earlier audit report. It reflects **v1 (prd.md) + v2 (prd-v2-scoring-queue-ops.md)** as implemented in code, plus honest gaps.

---

## Executive summary

| Area | Status |
|------|--------|
| **v1 PRD (Features 1–12)** | ✅ Largely complete |
| **v2 PRD (scoring, queue, admin data)** | ✅ Core complete · ⚠️ A2 partial · ❌ polish items remain |
| **Production deploy** | Edge functions exist in repo; deploy requires Supabase CLI access on operator account |
| **Ship smoke** | `npm run smoke:ship` — live RPC check (anon key) |

---

## Routes / pages

| Route | File | Status | Notes |
|-------|------|--------|-------|
| `/` | `index.tsx` | ✅ | Full form, OTP gate, structured reference, device fingerprint |
| `/track` | `track.tsx` | ✅ | Real RPC + real history timestamps |
| `/donate` | `donate.tsx` | ✅ | Live stats, ledger, adoptable families, pledge submit |
| `/auth` | `auth.tsx` | ✅ | Staff login |
| `/admin` | `admin.tsx` + `AdminShell.tsx` | ✅ | Auth gate via `AdminShellGate` |
| `/admin/` | `admin.index.tsx` | ✅ | Real overview + realtime |
| `/admin/requests` | `admin.requests.tsx` | ✅ | Server-side list, filters, export, saved views |
| `/admin/requests/$id` | `admin.requests.$id.tsx` | ✅ | Breakdown, override, inline edit, all detail actions |
| `/admin/queue` | `admin.queue.tsx` | ✅ | FIFO work queue, bulk assign, integrity panel |
| `/admin/scoring` | `admin.scoring.tsx` | ✅ | Category caps, raw_max, preview, bulk recalc |
| `/admin/references` | `admin.references.tsx` | ✅ | Mukhtar whitelist CRUD |
| `/admin/distribution` | `admin.distribution.tsx` | ✅ | Events, QR scan, PIN completion |
| `/admin/analytics` | `admin.analytics.tsx` | ✅ | Real aggregated queries |
| `/admin/users` | `admin.users.tsx` | ✅ | Create / deactivate / role (edge function) |
| `/admin/audit` | `admin.audit.tsx` | ✅ | Reads `audit_log`, Arabic labels |
| `/admin/donations` | `admin.donations.tsx` | ✅ | Verify / reject pledges |

---

## v2 implementation log (what we built)

### Feature A — Scoring

| Item | Status | Migration / code |
|------|--------|-------------------|
| A1 Urgency v2 + breakdown + tiers | ✅ | `20260606010000_urgency_v2_scoring.sql` |
| A1 Detail breakdown card | ✅ | `UrgencyBreakdownCard.tsx` |
| A3 Manual urgency override + priority flag | ✅ | `UrgencyOverrideSection.tsx` |
| A2 Config table + admin page | ✅ | `scoring_config` in v2 migration |
| A2 Runtime config (category caps, `raw_max`) | ✅ | `20260606050000_scoring_config_runtime.sql` |
| A2 Preview last 3 submissions | ✅ | `get_scoring_preview_samples` RPC |
| A2 Bulk recalculate all | ✅ | `bulk_recalculate_scores` RPC |
| A2 **Per-signal point values** editable in UI | ✅ | `admin.scoring.tsx` + runtime scoring config |
| Field edit → rescore with `field_change` label | ✅ | `20260606060000_field_edit_scoring_trigger.sql` |

### Feature B — Queue

| Item | Status | Migration / code |
|------|--------|-------------------|
| B1 Immutable `queue_number` + backfill | ✅ | `20260606000000_queue_number.sql` |
| B2 `queue_position` RPC | ✅ | `20260606020000_submissions_rpc_export.sql` |
| B3 `/admin/queue` FIFO view | ✅ | `admin.queue.tsx` |
| B3 List shows real queue #, URL sort params | ✅ | `admin.requests.tsx` |
| B3 Bulk assign top N | ✅ | `queue-assign.ts` |
| Realtime on queue page | ⚠️ | Overview + requests list only |

### Feature C — Admin data control

| Item | Status | Migration / code |
|------|--------|-------------------|
| C1 `list_submissions` RPC (replaces 200 cap) | ✅ | `20260606020000` |
| C1 Advanced filters (governorate, tags, dates) | ✅ | `20260606030000_list_submissions_advanced_filters.sql` |
| C1 Ops filters (assignee, score ranges, queue range, flags, reference) | ✅ | `20260606070000_list_submissions_ops_filters.sql` |
| C1 Page size 25 / 50 / 100 | ✅ | `submissions-list.ts` |
| C1 Keyset cursor pagination | ✅ | `list_submissions` keyset support + `admin.requests.tsx` loader |
| C1 `needs[]` filter | ✅ | `list_submissions` RPC + filter JSON payload |
| C2 Sync CSV export (≤5000 rows) | ✅ | `export_submissions_csv` + modal |
| C2 Async export jobs (>5000, max 50k) | ✅ | `20260606080000_export_jobs_async.sql` |
| C2 Export on `/admin/queue` | ✅ | `admin.queue.tsx` export button + modal |
| C2 Optional export columns (reference, tags, flags, …) | ❌ | 17 core columns only |
| C2 Signed Storage URL for large files | ✅ | `supabase/functions/export-job-url` + storage bucket |
| C2 Edge function async notify | ✅ | `supabase/functions/export-job-url` provides signed download URL after completion |
| C3 Saved views (filters + sort + columns) | ✅ | `admin_saved_views` |
| C3 Shared views (`is_shared`) | ✅ | `SavedViewsDropdown.tsx` |
| C4 Inline field editing on detail | ✅ | `EditableRequestSections.tsx`, `request-field-edit.ts` |

### Feature D — Observability

| Item | Status | Migration / code |
|------|--------|-------------------|
| D1 `urgency_score_history` + detail panel | ✅ | v2 scoring migration + `UrgencyHistoryPanel.tsx` |
| D2 Admin “فحص سلامة الدور” button | ✅ | `20260606040000_queue_integrity_check.sql` |
| D2 Nightly cron integrity check | ⚠️ | edge function available; schedule not configured |

---

## Key libraries & scripts (v2)

| Path | Purpose |
|------|---------|
| `src/lib/submissions-list.ts` | Filters, sort, pagination, `list_submissions` wrapper |
| `src/lib/export-submissions.ts` | Sync + async export, column picker helpers |
| `src/lib/saved-views.ts` | Saved view CRUD |
| `src/lib/scoring-config.ts` | Config fetch/save, preview, bulk recalc |
| `src/lib/queue-integrity.ts` | Integrity check RPC + audit |
| `src/lib/request-field-edit.ts` | Inline edit validation + save |
| `src/lib/queue-assign.ts` | Bulk reviewer assignment |
| `scripts/smoke-ship.mjs` | Live RPC existence check (`npm run smoke:ship`) |

---

## Migrations apply order (v2)

Apply in Supabase SQL editor in this order:

1. `20260606000000_queue_number.sql`
2. `20260606010000_urgency_v2_scoring.sql`
3. `20260606020000_submissions_rpc_export.sql`
4. `20260606030000_list_submissions_advanced_filters.sql`
5. `20260606040000_queue_integrity_check.sql`
6. `20260606050000_scoring_config_runtime.sql`
7. `20260606060000_field_edit_scoring_trigger.sql`
8. `20260606070000_list_submissions_ops_filters.sql`
9. `20260606080000_export_jobs_async.sql`

After apply: `npm run smoke:ship` should report all v2 RPCs reachable.

---

## v1 features (still accurate notes)

### Public form (`/`)

- ✅ OTP verification before submit (`PhoneOtpSection`, `send-otp` edge function)
- ✅ Structured `submission_references` insert
- ✅ Device fingerprint on submit
- ✅ Hero stats now live from `donation_impact_stats` instead of hardcoded values
- ⚠️ `ip_hash` still null (no server-side IP capture)

### Edge functions

| Function | Purpose | Deploy |
|----------|---------|--------|
| `send-otp` | SMS OTP via Twilio (or `OTP_DEV_LOG`) | Requires `supabase functions deploy` + Twilio secrets |
| `admin-user-management` | Create/deactivate users, roles | Same |

### Auth & roles

- ✅ `/auth` login, session persisted
- ✅ `AdminShellGate` blocks unauthenticated admin access
- ✅ RLS + `is_staff` / `has_role` enforced when signed in
- ✅ Export denied for `viewer`-only role (`canExport` helper)

### Audit log

- ✅ Written from admin actions including: status changes, export, field edit, queue integrity, scoring config, overrides, etc.
- ✅ `/admin/audit` reads real rows with Arabic action labels

---

## Still not done (prioritized)

### High value

1. **Apply pending migrations** on any environment missing `70000` / `80000`
2. **Regenerate `types.ts`** — `npm run types:gen` fails with CLI 403; file may need manual sync
3. **Deploy edge functions** to production if not already (`send-otp`, `admin-user-management`)
4. **Twilio secrets** for real SMS in production

### Medium

6. **Extended export columns** — reference fields, tags, flags, assigned reviewer, needs, children, elderly
8. **Nightly queue integrity cron** (pg_cron or Supabase scheduled function) — function exists at `supabase/functions/queue-integrity-check`

### Low / v2.1

12. **Storage-backed large exports** + signed download URL (implemented via `export-job-url` edge function)
13. **Export job email/in-app notification** when async job completes
14. **Excel (.xlsx)** export format
15. **Public applicant queue position** on `/track`
16. **Realtime** on detail page and queue page
17. **`user_preferences` table** for export columns (localStorage used today)
18. **Analytics: urgency drift graphs** from `urgency_score_history`

---

## Open questions — decisions made

| Question | Decision |
|----------|----------|
| Backfill queue numbers | Global sequence since launch (`ORDER BY created_at`) |
| Default list sort | **Effective urgency DESC**, then queue # ASC (work priority) |
| Reference denied | Post-normalization −10 raw points (see v2 scoring migration) |
| Viewer export | **Denied** — list yes, export no |
| Bulk recalc after config save | **Immediate** from admin UI with batch progress |
| Large export mechanism | SQL batched `export_jobs` + frontend poll + edge function for storage URL generation |

---

## Testing & ship checklist

```bash
npm run test          # 162 tests
npm run build         # production build
npm run smoke:ship    # live RPC smoke (needs .env)
```

**Manual UI smoke (admin):**

1. `/admin/requests` — all filter rows, saved view, export (sync + async if >5000 rows)
2. `/admin/queue` — FIFO list, bulk assign, integrity check
3. `/admin/scoring` — preview, save config, bulk recalc
4. `/admin/requests/[id]` — inline edit → urgency history shows `field_change`
5. `/admin/audit` — `export_csv`, `field_updated`, `queue_integrity_check` entries

---

*Maintained alongside [prd.md](./prd.md) and [prd-v2-scoring-queue-ops.md](./prd-v2-scoring-queue-ops.md).*
