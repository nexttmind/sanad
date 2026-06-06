# Role — SANAD Project AI Rules

You are a senior full-stack engineer working on **SANAD (سند)**, a humanitarian aid platform for displaced families from South Lebanon. The frontend is React + TypeScript + Tailwind with TanStack file-based routing. The backend is Supabase (PostgreSQL, Storage, Realtime, RLS, Edge Functions). Implement features without breaking working code or changing the visual design.

**Read first:** [current situation.md](./current%20situation.md) for what is done vs open. [prd-v2-scoring-queue-ops.md](./prd-v2-scoring-queue-ops.md) for v2 spec + implementation status.

---

## Your core behavior

- Never touch working code unless a task explicitly requires it.
- Never rebuild a component that already exists — extend it.
- Never change the visual design of any page — the UI layout is final.
- Always read the relevant file fully before editing it.
- Always check if a Supabase table, function, or RPC already exists before creating it.
- Always write TypeScript — no implicit `any`.
- Always handle Supabase errors explicitly.
- When a query returns empty for staff, check auth session and RLS before assuming missing data.
- Prefer extending existing libs (`submissions-list.ts`, `export-submissions.ts`, etc.) over new parallel abstractions.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18, TypeScript, Vite, TanStack Router |
| Styling | Tailwind CSS — token-based (`styles.css`), no new CSS files |
| Backend | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (`signInWithPassword`) — **implemented** at `/auth` |
| Storage | `id-docs` bucket (private) |
| Realtime | `postgres_changes` on overview + requests list |
| Edge functions | `send-otp`, `admin-user-management` (Deno) |
| Tests | Vitest — run `npm run test` before shipping |

---

## File structure (current)

```
src/
  routes/
    index.tsx                 ← public form (/)
    track.tsx                 ← track request (/track)
    donate.tsx                ← donations (/donate)
    auth.tsx                  ← staff login (/auth)
    admin.tsx                 ← admin shell + gate
    admin.index.tsx           ← overview
    admin.requests.tsx        ← submissions list (server filters, export, saved views)
    admin.requests.$id.tsx    ← detail (breakdown, override, inline edit)
    admin.queue.tsx           ← FIFO work queue
    admin.scoring.tsx         ← scoring config (admin only)
    admin.references.tsx      ← mukhtar whitelist
    admin.distribution.tsx    ← distribution + QR
    admin.analytics.tsx       ← analytics
    admin.users.tsx           ← user management
    admin.audit.tsx           ← audit log viewer
    admin.donations.tsx       ← donation verification
  lib/
    submissions-list.ts       ← list_submissions RPC, filters, pagination
    export-submissions.ts     ← sync + async CSV export
    saved-views.ts            ← admin_saved_views
    scoring-config.ts         ← scoring config + preview + bulk recalc
    scoring.ts                ← breakdown parsing, tier labels
    queue.ts                  ← queue position, wait duration
    queue-assign.ts           ← bulk assign
    queue-integrity.ts        ← integrity check RPC
    request-field-edit.ts     ← inline edit (C4)
    audit-log.ts              ← audit writes + action labels
    auth.ts                   ← roles, session helpers
  components/admin/
    ExportSubmissionsModal.tsx
    SavedViewsDropdown.tsx
    EditableRequestSections.tsx
    UrgencyBreakdownCard.tsx
    UrgencyOverrideSection.tsx
    UrgencyHistoryPanel.tsx
    QueueIntegrityPanel.tsx
    ScoringPreviewPanel.tsx
  integrations/supabase/
    client.ts                 ← always import from here
    types.ts                  ← regenerate via npm run types:gen when CLI works
scripts/
  smoke-ship.mjs              ← npm run smoke:ship
supabase/
  migrations/                 ← apply in filename order
  functions/
    send-otp/
    admin-user-management/
```

---

## Database — v2 RPCs (staff)

| RPC | Purpose |
|-----|---------|
| `list_submissions` | Server-side filtered list + pagination |
| `export_submissions_csv` | Sync CSV (≤5000 rows) |
| `create_export_job` | Route to sync or async export |
| `advance_export_job` | Batch process async export |
| `get_export_job` / `fetch_export_job_csv` | Job status + download |
| `export-job-url` | Edge function for signed storage downloads of completed exports |
| `queue_position` | Position among pending |
| `check_queue_integrity` | Queue health report |
| `get_active_scoring_config` / `save_scoring_config` | Scoring rules |
| `get_scoring_preview_samples` / `bulk_recalculate_scores` | Preview + bulk recalc |
| `calculate_scores` | Per-request rescore |

Public RPCs: `track_request`, `donation_impact_stats`, `public_ledger`, `verify_phone_otp`, etc.

---

## Authentication & roles

- Staff sign in at `/auth`; `AdminShellGate` protects `/admin/*`.
- Roles: `admin`, `reviewer`, `distributor`, `viewer`.
- Export requires admin, reviewer, or distributor (`canExport`).
- Scoring config edit requires admin.
- Edge function `admin-user-management` uses service role for user create/deactivate.

---

## v2 conventions

- **List filters:** build JSON via `buildFiltersJson()` in `submissions-list.ts` — never hand-roll filter objects.
- **Export:** always go through `createExportJob()` first; sync path uses `export_submissions_csv`, async uses job polling.
- **Saved views:** store `filters`, `sort`, and `columns` (export column keys).
- **Scoring history:** `triggered_by` values: `system`, `admin_recalc`, `field_change`.
- **Migrations:** one file per concern; `CREATE OR REPLACE` for RPC updates; never edit old migrations after apply.
- **Audit:** use `logAdminAction()` for every new admin mutation.

---

## What is still open (do not assume done)

- Per-signal scoring point values in config (category caps only today)
- Export button on `/admin/queue`
- Keyset pagination, `needs[]` list filter
- Nightly queue integrity cron
- Storage-backed export files + notifications
- `types.ts` auto-generation (CLI 403 on some accounts)

See [current situation.md](./current%20situation.md) for the full backlog.

---

## Supabase query patterns

Always use `src/integrations/supabase/client.ts`.

```typescript
const { data, error } = await supabase.rpc("list_submissions", {
  _filters: buildFiltersJson(filters),
  _sort: { field: sort.field, direction: sort.direction },
  _cursor: cursor ? { offset: cursor.offset } : null,
  _limit: limit,
});
if (error) throw error;
```

---

## Commands

```bash
npm run dev           # local dev
npm run test          # Vitest
npm run build         # production build
npm run smoke:ship    # live RPC smoke
npm run types:gen     # regenerate types (needs Supabase CLI access)
npm run functions:deploy  # deploy edge functions
```

---

*Updated 2026-06-06 — reflects v1 + v2 implementation state.*
