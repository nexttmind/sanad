# Update Summary

This change set implemented the following updates:

- `src/lib/scoring-config.ts`
  - Extended `ScoringConfigRules` to include per-signal `weights` for each scoring category.
  - Added default scoring config rules and normalization helpers for backward compatibility.
  - Added parsing logic so active config RPC payloads normalize configured weights correctly.

- `src/routes/admin.scoring.tsx`
  - Added UI controls for editing per-signal weights within each scoring category.
  - Preserved existing category max, `raw_max`, and `priority_override_floor` controls.
  - Added update handlers for both category maximums and weight values.

- `src/lib/submissions-list.ts`
  - Added `needs?: string[]` to `SubmissionFilters`.
  - Added `needs` propagation into `buildFiltersJson(filters)`.

- `src/routes/admin.requests.tsx`
  - Added client-side `needs` state and filter handling.
  - Added a new multi-select filter input for request needs.
  - Added `needs` support in saved view restoration and reset logic.

- `supabase/migrations/20260606050000_scoring_config_runtime.sql`
  - Extended `calculate_scores()` to read per-signal weights from active scoring config.
  - Replaced hard-coded signal point values with configured weight variables.
  - Kept category caps and raw score normalization.

- `supabase/migrations/20260606070000_list_submissions_ops_filters.sql`
  - Added parsing of `_filters->'needs'` from JSONB.
  - Added `needs` filter logic to both count and row queries for `list_submissions`.
  - Added keyset pagination cursor support and preserved offset cursor compatibility for `list_submissions`.

- `src/lib/submissions-list.ts`
  - Added typed cursor support for both offset and keyset pagination.
  - Updated `listSubmissions()` RPC payload handling to send and parse both cursor formats.

- `src/routes/admin.queue.tsx`
  - Added export action and integrated `ExportSubmissionsModal` into the admin queue page.

- `src/lib/__tests__/scoring-config.integration.test.ts`
  - Updated sample config to include required `weights` property.

- `supabase/migrations/20260606090000_donation_proof_photos.sql`
  - Added `donation_proof_photos` metadata table and seed rows for the public donation gallery.

- `src/lib/donations.ts`
  - Added `fetchDonationProofPhotos()` to load seeded gallery metadata.

- `src/lib/donate-photos.ts`
  - Added local static asset mapping for seeded donation gallery photo keys.

- `src/routes/donate.tsx`
  - Replaced the hard-coded proof gallery mock with database-driven photo metadata and local asset mapping.

- `supabase/migrations/20260606091000_donation_impact_stats_extended.sql`
  - Extended `donation_impact_stats()` to include homepage hero metrics: request count, verification rate, and average response time.

- `src/routes/index.tsx`
  - Replaced hardcoded hero counters with live stats fetched from `donation_impact_stats()`.

- `src/lib/export-submissions.ts`
  - Added signed export URL helper and edge-function-backed storage support for completed async export jobs.

- `src/components/admin/ExportSubmissionsModal.tsx`
  - Preserved async export progress and added persistence of completed CSV jobs to storage when available.

- `supabase/functions/export-job-url/index.ts`
  - Added an edge function to persist completed async export CSV files to storage and issue signed download URLs.

- `supabase/functions/queue-integrity-check/index.ts`
  - Added an edge function to run `check_queue_integrity()` for scheduled or authenticated admin calls.

- `supabase/config.toml`
  - Registered `export-job-url` and `queue-integrity-check` edge functions.

- `package.json`
  - Extended Supabase functions deploy scripts to include the new queue integrity edge function.

- `md files/current situation.md`
  - Updated nightly integrity cron status to note that an edge function exists and scheduling is not yet configured.

- `md files/prd-v2-scoring-queue-ops.md`
  - Updated large export notes with signed URL and edge function support.

- `md files/role.md`
  - Added edge function reference for signed export storage downloads.

- General
  - Included all prior and current updates in this change summary.

No new dependencies were added.

- **Step 10.2 (risk remediation playbook):** Realtime on admin request detail page
  - `src/routes/admin.requests.$id.tsx` — filtered `postgres_changes` subscriptions for `aid_requests`, `aid_request_notes`, `aid_request_history`, and `aid_request_files`; status/history/notes refresh without manual reload
  - `admin.queue.tsx` — already had realtime on `aid_requests` (no change)

- **Step 8.1 (risk remediation playbook):** TanStack Query caching for public donation reads
  - `src/lib/donations.ts` — `useDonationImpactStats`, `usePublicLedger`, `useAdoptableFamilies` with 60s stale / 5m gc
  - `src/routes/index.tsx`, `src/routes/donate.tsx` — replaced mount-time fetches with shared query hooks

- **Step 10.1 (risk remediation playbook):** Extended CSV export columns
  - `supabase/migrations/20260607100000_export_extended_columns.sql` — optional columns: reference fields, tags, flags, needs, children, elderly, assigned_to; sync export uses shared `build_export_csv_chunk`
  - `src/lib/export-submissions.ts`, `ExportSubmissionsModal.tsx` — core vs optional column toggles (localStorage preserved)

- **Step 1.1 (risk remediation playbook):** `donation_proof_photos` RLS
  - `supabase/migrations/20260607110000_donation_proof_photos_rls.sql` — public read-only; admin manage; revoke anon INSERT/UPDATE/DELETE

- **Step 1.2 (risk remediation playbook):** `queue_position` staff-only
  - `supabase/migrations/20260607120000_queue_position_staff_only.sql` — `is_staff` check; applicants use Phase 9 scoped RPC later
  - `src/lib/__tests__/queue.integration.test.ts` — auth error propagation test

- **Step 2.1 (risk remediation playbook):** Shared rate-limit RPC
  - `supabase/migrations/20260607130000_rate_limit_rpc.sql` — `check_rate_limit`, `log_rate_limit_block`; service_role only
  - `src/lib/rate-limit.ts`, `src/lib/__tests__/rate-limit.integration.test.ts`

- **Step 2.2 (risk remediation playbook):** Track lookup rate limits
  - `supabase/functions/track-request-proxy/index.ts` — 30/hr IP, 10/hr phone via `check_rate_limit`; calls `track_request` + `track_request_history` with service role
  - `supabase/migrations/20260607140000_track_request_rate_limit.sql` — revoke direct RPC from anon/authenticated
  - `src/lib/track-request.ts`, `src/routes/track.tsx` — proxy invoke + rate-limited UI state
  - `src/lib/__tests__/track-request.test.ts`, `package.json`, `supabase/config.toml`

- **Step 2.3 (risk remediation playbook):** Donation pledge rate limits
  - `supabase/functions/submit-donation/index.ts` — 10/hr IP, 5/hr phone; insert + optional proof upload via service role
  - `supabase/migrations/20260607150000_donation_rate_limit.sql` — revoke direct INSERT on `donations` / `payment_proofs`
  - `src/lib/donations.ts`, `DonationSubmitForm.tsx` — proxy invoke + `DonationSubmitError`
  - `src/lib/__tests__/donations.integration.test.ts`, `package.json`, `supabase/config.toml`

- **Step 3.1 (risk remediation playbook):** Capture ip_hash on aid request submit
  - `supabase/functions/submit-aid-request/index.ts` — OTP gate + `hashIdentifier` from x-forwarded-for; service_role insert
  - `supabase/migrations/20260607160000_aid_request_ip_hash.sql` — revoke direct INSERT on `aid_requests`
  - `src/lib/submit-aid-request.ts`, `src/routes/index.tsx` — proxy invoke replaces client insert
  - `src/lib/__tests__/submit-aid-request.integration.test.ts`, `package.json`, `supabase/config.toml`

- **Step 4.1 (risk remediation playbook):** Storage upload hardening
  - `supabase/migrations/20260607170000_storage_upload_hardening.sql` — block direct public INSERT on `id-docs` / `payment-proofs`
  - `supabase/functions/upload-id-doc/index.ts` — 5/hr IP, UUID path, MIME allowlist, 5MB max; inserts `aid_request_files`
  - `src/lib/upload-id-doc.ts`, `src/routes/index.tsx` — proxy replaces client storage upload
  - `src/lib/__tests__/upload-id-doc.integration.test.ts`, `package.json`, `supabase/config.toml`

- **Step 6.1 (risk remediation playbook):** Distribution PIN lockout
  - `supabase/migrations/20260607180000_distribution_pin_lockout.sql` — `pin_attempt_log`, `verify_distribution_pin`
  - `src/lib/distribution.ts` — RPC replaces client-side PIN compare; `locked` error code
  - `src/lib/__tests__/distribution.integration.test.ts`

- **Step 5.1 (risk remediation playbook):** Edge function CORS allowlist
  - `supabase/functions/_shared/cors.ts` — `ALLOWED_ORIGINS` env (defaults: localhost dev ports)
  - All 8 edge functions use `handleCorsPreflight` + `jsonWithCors`; unknown browser origins get 403

- **Step 0.3 (risk remediation playbook):** Manual `types.ts` sync
  - `src/integrations/supabase/types.ts` — tables/enums/RPCs from migrations (CLI 403)
  - Minor fixes: `admin.index.tsx` Database import, `request-field-edit.ts` update cast

- **Step 7.1 (risk remediation playbook):** Export job keyset cursor
  - `20260607190000_export_job_keyset_cursor.sql` — `export_jobs.last_cursor`; `advance_export_job` uses keyset not offset

- **Step 9.1 (risk remediation playbook):** Public track queue position
  - `20260607200000_track_queue_position.sql` — `track_queue_position(_code, _phone)` RPC
  - `track-request-proxy` returns `queue`; `/track` shows position for pending requests

- **Step 11.1 (risk remediation playbook):** Nightly queue integrity cron
  - `20260607210000_queue_integrity_scheduled_cron.sql` — service_role RPC + pg_cron `0 3 * * *`
  - `queue-integrity-check` edge function: service-role scheduled path, audit on unhealthy
  - `npm run cron:verify-integrity` — manual scheduled invoke test
