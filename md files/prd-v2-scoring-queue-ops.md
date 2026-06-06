# PRD v2 — Urgency Scoring, Submission Queue & Admin Data Control

**Status:** ✅ **Core complete** (2026-06-06) — see [Implementation status](#implementation-status) below.  
**Companion doc:** [current situation.md](./current%20situation.md) — live inventory of done vs open.

**Audience:** Product + engineering. Implements on top of the existing SANAD admin platform without redesigning UI.

---

## Implementation status

| # | Feature | PRD section | Status | Notes |
|---|---------|-------------|--------|-------|
| 1 | Queue numbers | B1 | ✅ Done | `20260606000000_queue_number.sql` |
| 2 | Urgency v2 + breakdown | A1 | ✅ Done | Category caps, tiers, `urgency_breakdown` JSONB |
| 3 | Queue position + work queue | B2–B3 | ✅ Done | `/admin/queue`, bulk assign, URL sort |
| 4 | Server-side list | C1 | ✅ Done | Advanced + ops filters; offset pagination |
| 5 | CSV export | C2 | ✅ Done | Sync ≤5000 + async `export_jobs` ≤50k |
| 6 | Manual override | A3 | ✅ Done | Override + priority flag + audit |
| 7 | Configurable scoring | A2 | ✅ Done | Category caps + `raw_max` + preview + bulk recalc + per-signal point values |
| 8 | Saved views | C3 | ✅ Done | Filters, sort, export columns, `is_shared` |
| 9 | Inline edit | C4 | ✅ Done | Section edit + `field_change` rescore |
| 10 | History + integrity | D1–D2 | ✅ Done | History panel + admin integrity button |

**Tests:** 162 Vitest · **Ship smoke:** `npm run smoke:ship`

### Implemented migrations (apply in order)

| File | Purpose |
|------|---------|
| `20260606000000_queue_number.sql` | Sequence, backfill, `queued_at` |
| `20260606010000_urgency_v2_scoring.sql` | Scoring v2, tiers, breakdown, history table, overrides |
| `20260606020000_submissions_rpc_export.sql` | `list_submissions`, `export_submissions_csv`, `queue_position`, `admin_saved_views`, scoring config RPCs |
| `20260606030000_list_submissions_advanced_filters.sql` | Governorate, tags, date range |
| `20260606040000_queue_integrity_check.sql` | `check_queue_integrity()` |
| `20260606050000_scoring_config_runtime.sql` | Config-driven `calculate_scores`, preview, bulk recalc |
| `20260606060000_field_edit_scoring_trigger.sql` | Rescore on inline edit (`field_change`) |
| `20260606070000_list_submissions_ops_filters.sql` | Assignee, score/queue ranges, flags, reference status |
| `20260606080000_export_jobs_async.sql` | Async export jobs for >5000 rows |

### Frontend / lib touches (v2)

| Area | Files |
|------|-------|
| Requests list | `admin.requests.tsx`, `submissions-list.ts` |
| Export | `ExportSubmissionsModal.tsx`, `export-submissions.ts` |
| Saved views | `SavedViewsDropdown.tsx`, `saved-views.ts` |
| Queue | `admin.queue.tsx`, `queue-assign.ts`, `QueueIntegrityPanel.tsx`, `queue-integrity.ts` |
| Scoring admin | `admin.scoring.tsx`, `scoring-config.ts`, `ScoringPreviewPanel.tsx` |
| Detail page | `UrgencyBreakdownCard`, `UrgencyOverrideSection`, `UrgencyHistoryPanel`, `EditableRequestSections`, `request-field-edit.ts` |
| Audit | `audit-log.ts` — actions: `export_csv`, `field_updated`, `queue_integrity_check`, override events, `scoring_config_updated` |
| Ship tooling | `scripts/smoke-ship.mjs`, `npm run smoke:ship`, `npm run types:gen` |

### Not done (v2 remainder)

| Item | PRD ref | Priority |
|------|---------|----------|
| Optional export columns (reference, tags, flags, needs, …) | C2 | Medium |
| Signed Storage URL + edge notify for large exports | C2 | Low (DB batch export works) |
| Nightly queue integrity cron | D2 | Low |
| Live hero stats on public form | — | ✅ Done | Now driven by `donation_impact_stats` |
| Regenerate `types.ts` via CLI | — | High (403 on some accounts) |
| Realtime on queue + detail pages | B3 | Low |
| Excel export | C2 | Low |
| Public queue position on `/track` | Non-goal | v2.1 |

---

## Why this PRD exists

v1 delivered auth, review workflows, distribution, donations, and analytics. Three gaps remain that block fair, auditable operations at scale:

1. **Urgency score is opaque and easy to game toward 100** — rules are hardcoded in SQL, add linearly, cap at 100, and leave no breakdown for staff.
2. **Admin cannot reliably extract the exact dataset they need** — no export, no saved views, list capped at 200 rows, filters are client-side only.
3. **Submission order is not durable** — `#` in the list is the filtered row index, not a permanent “who arrived first” number; default sort is newest-first.

This PRD defines a second implementation phase focused on **scoring logic**, **FIFO queue integrity**, and **admin operational control**.

---

## Goals

| Goal | Success looks like |
|------|-------------------|
| Fair urgency | Two staff members explain the same score the same way; breakdown is visible |
| Admin tunability | Weights and thresholds editable without redeploying app code |
| FIFO truth | Every submission has an immutable arrival number; queue position is queryable |
| Reliable export | Admin exports exactly what they filtered, with chosen columns, audited |
| Override with accountability | Manual urgency/priority changes require reason + audit entry |

---

## Non-goals (v2)

- Replacing trust/fraud scoring (trust stays separate; only urgency is redesigned in depth)
- Public-facing queue position for applicants (optional later)
- ML-based scoring
- Redesigning admin UI layout

---

## Pre-v2 baseline (historical — superseded)

> The bullets below described the codebase **before** v2. They are kept for context only.

- Urgency was opaque linear sum capped at 100; no breakdown.
- No `queue_number`; list `#` was client row index; 200-row cap; client-side filters.
- No export UI, saved views, or server-side list RPC.

**Today:** see [Implementation status](#implementation-status) and [current situation.md](./current%20situation.md).

---

## Design principles

1. **Separate “need urgency” from “trust risk”** — urgency drives aid prioritization; trust drives verification effort.
2. **Store the explanation, not just the number** — every recalculation persists a JSON breakdown.
3. **Configurable weights, frozen history** — rule changes apply on next recalc; old breakdowns remain in audit/history.
4. **Immutable arrival order** — `queue_number` assigned once at insert, never updated.
5. **Effective sort = urgency then FIFO** — among equal urgency, earlier `queue_number` wins.
6. **Admin override is explicit** — manual score or `priority_override` requires reason; logged to `audit_log`.

---

# Feature A — Transparent urgency scoring engine

## A1. Scoring model (replace linear sum)

Replace the current additive cap model with **category caps + weighted sub-scores**, then normalize to 0–100.

### Categories (default weights — admin-configurable)

| Category | Max pts | Signals |
|----------|---------|---------|
| **Shelter** | 25 | school/UN shelter (+25), informal shelter (+20), rented (+12), with relatives (+5), destroyed home flag (+15) |
| **Medical** | 25 | critical medicine need (+15), chronic illness (+10), disabled member (+10) — **category capped at 25** |
| **Dependents** | 25 | infants: +8 each (cap 16), elderly: +4 each (cap 8), pregnant/nursing (+10), 3+ children (+5) |
| **Displacement** | 15 | Sliding scale: displaced ≤7 days (+15), ≤30 days (+10), ≤90 days (+5), older (+0) |
| **Household load** | 10 | family_size ≥8 (+10), ≥6 (+7), ≥4 (+4) |
| **Reference** | 5 | reference confirmed (+5), denied (−10 applied post-normalization floor at 0) |

**Raw total** = sum of category scores (max 105 before reference penalty).  
**Normalized urgency** = `ROUND(LEAST(GREATEST(raw_total, 0), 105) * 100 / 105)`.

### Urgency tiers (derived, stored)

| Tier | Score range | Arabic label |
|------|-------------|--------------|
| `critical` | 85–100 | حرج |
| `high` | 70–84 | عالي |
| `medium` | 45–69 | متوسط |
| `low` | 0–44 | منخفض |

Store as enum `urgency_tier` on `aid_requests` (separate from `risk_level` which stays trust-based).

### Effective urgency (for sorting & display)

```
effective_urgency =
  IF manual_urgency IS NOT NULL → manual_urgency
  ELIF priority_override → GREATEST(calculated_urgency, override_floor)  -- default floor 85
  ELSE calculated_urgency
```

### Acceptance criteria

- `calculate_scores` refactored to one canonical function (remove duplicate migration copies).
- Returns and stores `urgency_breakdown` JSONB:

```json
{
  "version": 2,
  "categories": {
    "shelter": { "points": 25, "max": 25, "reasons": ["school_shelter"] },
    "medical": { "points": 15, "max": 25, "reasons": ["chronic_illness", "medicine_need"] }
  },
  "raw_total": 78,
  "normalized": 74,
  "tier": "high",
  "effective": 74
}
```

- Admin detail page shows **expandable breakdown card** (Arabic labels per reason code).
- Recalculate button refreshes breakdown; audit log records old/new scores.
- `pregnant_or_nursing` included when true.
- Reference contact result (`confirmed` / `denied`) affects urgency category.

---

## A2. Admin-configurable scoring rules

New table `scoring_config` (singleton row or versioned rows):

| Column | Purpose |
|--------|---------|
| `id` | UUID |
| `version` | INT incrementing |
| `rules` | JSONB — category maxima, point values per signal key |
| `is_active` | BOOLEAN — one active config |
| `updated_by` | UUID |
| `updated_at` | TIMESTAMPTZ |

Admin page **`/admin/scoring`** (admin role only):

- Edit point values per signal (numeric inputs).
- Preview impact on 3 sample submissions (pick from recent).
- Save creates new version; triggers optional bulk recalc (background, batched).
- Cannot edit while bulk recalc running.

### Acceptance criteria

- Active config read by `calculate_scores` at runtime.
- Default config seeded via migration matching table above.
- Changing config and recalculating updates `urgency_breakdown.version`.
- Non-admin roles can view breakdown but not edit config.

---

## A3. Manual urgency override

On submission detail (`admin.requests.$id`):

- **Override urgency** — numeric 0–100 + required reason textarea.
- **Priority flag** — toggle `priority_override` (boosts to floor, default 85).
- **Clear override** — reverts to calculated; reason required.
- All actions → `audit_log` (`urgency_override`, `priority_override_set`, `priority_override_cleared`).

### Acceptance criteria

- `manual_urgency`, `manual_urgency_reason`, `manual_urgency_by`, `manual_urgency_at` columns on `aid_requests`.
- List and queue views use `effective_urgency` for sort/display when override present.
- Breakdown card shows banner: “تم تعديل العجلة يدوياً — [reason]”.

---

# Feature B — Submission queue (FIFO order)

## B1. Immutable queue number

At **`INSERT` on `aid_requests`** (trigger, before scoring):

- Assign `queue_number` from sequence `aid_requests_queue_number_seq` (BIGINT, no gaps required but monotonic).
- Set `queued_at = now()` (same as insert time; explicit column for clarity).

Properties:

- **Never updated** on status change, rescore, or edit.
- **Unique** across all submissions.
- Display format: `#1842` or zero-padded `#001842` in admin UI.

### Acceptance criteria

- Migration backfills existing rows: `ORDER BY created_at ASC` → assign 1..N.
- New inserts get next sequence value automatically.
- Public/anonymous users cannot read queue numbers (staff-only column in RLS).

---

## B2. Queue position (computed)

RPC `queue_position(_request_id UUID)` returns:

```json
{
  "queue_number": 1842,
  "position_among_pending": 37,
  "pending_total": 412,
  "estimated_wait_days": null
}
```

`position_among_pending` = count of rows where:
- `status IN ('submitted','reviewing','verifying','on_hold')`
- AND (`effective_urgency`, `queue_number`) sorts before this row  
  using order: **`effective_urgency DESC, queue_number ASC`**.

### Acceptance criteria

- Detail page shows: “الترتيب في الدور: **37** من **412** قيد المعالجة”.
- Overview dashboard widget: total pending + oldest pending `queue_number`.

---

## B3. Queue-aware list & dedicated queue view

**Update `/admin/requests`:**

- Default sort: **`queue_number ASC`** (oldest arrivals first) — configurable toggle.
- Sort options: `queue_number`, `effective_urgency`, `created_at`, `trust_score`.
- Column **#** shows real `queue_number`, not row index.
- Server-side sort + pagination (see Feature C).

**New `/admin/queue`** (optional dedicated view):

- FIFO list of `submitted` + `reviewing` only.
- Columns: queue #, name, region, effective urgency, tier, wait time, assigned reviewer.
- Bulk assign top N to reviewer.

### Acceptance criteria

- Changing sort persists in URL query params (`?sort=urgency&dir=desc`).
- Wait time = `now() - queued_at` displayed as “3 أيام”.
- Realtime subscription updates positions when new submissions arrive.

---

# Feature C — Admin data control & export

## C1. Server-side list query (replace 200-row cap)

RPC `list_submissions(filters JSONB, sort JSONB, cursor JSONB, limit INT)`:

**Filters (all optional):**

- `status[]`, `urgency_tier[]`, `risk_level[]`
- `governorate`, `needs[]`, `tag_ids[]`
- `assigned_to`, `unassigned_only`
- `trust_min`, `trust_max`, `urgency_min`, `urgency_max`
- `queue_from`, `queue_to`
- `created_from`, `created_to`
- `search` (name, phone, reference_code)
- `has_flags`, `reference_confirmed`

**Sort:** `{ field, direction }` — allowed fields whitelisted.

**Pagination:** keyset cursor on `(sort_field, id)` — no offset drift.

Returns: rows + `next_cursor` + `total_count` (approx or exact via separate count query).

### Acceptance criteria

- `/admin/requests` uses RPC instead of `select * limit 200`.
- Filters applied in SQL, not client filter.
- Risk filter uses `risk_level` enum, not trust thresholds.
- Page size selectable: 25 / 50 / 100.

---

## C2. CSV / Excel export

Button **“تصدير”** on requests list and queue view.

Flow:

1. Admin applies filters + column picker (modal).
2. Frontend calls RPC `export_submissions(filters, columns[])` → returns **signed Storage URL** or streams CSV for ≤5000 rows.
3. Large exports (>5000): insert `export_jobs` row, batched SQL processing via `advance_export_job` (frontend polls). Completed exports can be persisted to storage with a signed URL via a new `export-job-url` edge function.
4. Always writes `audit_log` action `export_csv` with filters + column list + row count.

**Default export columns:**

`queue_number`, `reference_code`, `full_name`, `phone`, `governorate`, `town`, `housing_type`, `family_size`, `infants`, `children`, `elderly`, `needs`, `status`, `trust_score`, `urgency_score`, `effective_urgency`, `urgency_tier`, `risk_level`, `reference_name`, `reference_phone`, `reference_result`, `assigned_reviewer`, `tags`, `flags`, `created_at`, `queued_at`

**Optional columns:** document status, fraud flags, notes count, distribution date, internal notes.

### Acceptance criteria

- Exported file matches visible filters exactly (verified by integration test).
- UTF-8 with BOM for Excel Arabic compatibility.
- Column picker remembers last selection per admin user (`user_preferences` JSONB or localStorage fallback).
- Export denied for `viewer` role (read-only can list but not export — configurable).

---

## C3. Saved views

Table `admin_saved_views`:

| Column | Purpose |
|--------|---------|
| `user_id` | owner |
| `name` | e.g. “صور — حرج — بانتظار” |
| `filters` | JSONB |
| `sort` | JSONB |
| `columns` | JSONB |

UI: dropdown “العروض المحفوظة” on requests page — load / save / delete.

### Acceptance criteria

- One click restores filters + sort + columns.
- Shared views (optional v2.1): admin can mark view as `is_shared` for all staff.

---

## C4. Inline field editing (controlled)

Allow admin/reviewer to edit **non-scoring** fields from detail page without SQL:

- Applicant phone, alt phone, governorate, town, housing_type, family counts, needs array.
- Each save → audit log `field_updated` with diff.

**Not editable inline:** `queue_number`, `reference_code`, trust/urgency scores (use override flow instead).

### Acceptance criteria

- Edit mode toggle on detail sections.
- Validation matches public form rules (Lebanese phone, family_size ≥ 1).
- Scoring trigger re-runs after relevant field changes.

---

# Feature D — Observability & integrity

## D1. Scoring audit trail

Table `urgency_score_history`:

| Column | Purpose |
|--------|---------|
| `request_id` | FK |
| `calculated_urgency` | INT |
| `effective_urgency` | INT |
| `breakdown` | JSONB |
| `config_version` | INT |
| `triggered_by` | `system` \| `admin_recalc` \| `field_change` |
| `actor_id` | UUID nullable |
| `created_at` | TIMESTAMPTZ |

Append row on every recalculation.

### Acceptance criteria

- Detail page “سجل العجلة” shows last 10 entries.
- Analytics can graph urgency drift over time for a cohort.

---

## D2. Queue integrity checks

Nightly cron or admin button **“فحص سلامة الدور”**:

- Verify `queue_number` uniqueness.
- Verify sequence ≥ MAX(queue_number).
- Report duplicate phones in active queue (informational, not blocking).

---

# Database migrations (summary)

See [Implemented migrations](#implemented-migrations-apply-in-order) in Implementation status for the authoritative list (`000000` through `080000`).

Regenerate types after apply: `npm run types:gen` (requires Supabase CLI project access). Manual `types.ts` patches were used when CLI returns 403.

---

# UI changes (extend existing — no redesign)

| Location | Change |
|----------|--------|
| `admin.requests.tsx` | Server filters, real queue #, sort toggles, export button, saved views |
| `admin.requests.$id.tsx` | Breakdown card, override controls, queue position badge |
| `admin.index.tsx` | Pending queue stats, oldest wait time |
| `admin.queue.tsx` | **New** — FIFO work queue |
| `admin.scoring.tsx` | **New** — weight config (admin only) |
| `AdminShell.tsx` | Nav: “الدور”, “قواعد العجلة” |

---

# Implementation priority

Do in this order — each builds on the previous.

| # | Feature | Why first |
|---|---------|-----------|
| 1 | **B1 Queue number** | Foundational; cheap; fixes “who was first” immediately |
| 2 | **A1 Scoring model v2 + breakdown** | Core business logic; unblocks fair prioritization |
| 3 | **B2–B3 Queue position + list sort** | Makes queue numbers visible and usable |
| 4 | **C1 Server-side list** | Required before export at scale |
| 5 | **C2 Export** | Highest admin ask after scoring |
| 6 | **A3 Manual override** | Needs effective_urgency from A1 |
| 7 | **A2 Configurable weights** | Tune after real data from A1 |
| 8 | **C3 Saved views** | Quality-of-life after export works |
| 9 | **C4 Inline edit** | Optional; can ship later |
| 10 | **D1–D2 History & integrity** | Hardening |

---

# Testing requirements

- Unit tests for breakdown normalization math (TS mirror of SQL or pure SQL tests via pgTAP).
- Unit tests for effective_urgency with override/priority flag.
- Integration tests for `queue_number` monotonic assignment.
- Export test: filter → export → row count matches `list_submissions` count.
- Vitest coverage for new libs: `scoring.ts`, `export.ts`, `queue.ts`.

---

# Open questions — resolved

| # | Question | Decision |
|---|----------|----------|
| 1 | Backfill queue numbers | Global sequence since launch (`ORDER BY created_at`) |
| 2 | Default list sort | **Effective urgency DESC**, tie-break **queue_number ASC** |
| 3 | Reference denied | −10 raw points post-normalization (floor at 0) |
| 4 | Viewer role export | **List yes, export no** (`canExport` enforces) |
| 5 | Bulk recalc timing | **Immediate** from admin UI with batch progress |

---

# Relationship to v1 PRD

| v1 PRD | Status |
|--------|--------|
| Features 1–12 | ✅ Complete (see [prd.md](./prd.md)) |
| `calculate_scores` | ✅ Replaced with v2 category-cap model + config runtime |
| `priority_override` | ✅ Wired — A3 UI + effective urgency |
| Audit `export_csv` | ✅ Wired — sync + async export |
| Admin requests list | ✅ Server RPC, filters, export, saved views |
| Admin auth + audit | ✅ `/auth`, `AdminShellGate`, `logAdminAction` |

---

*Document version: 2026-06-06 — SANAD PRD v2 (core shipped)*
