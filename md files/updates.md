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
