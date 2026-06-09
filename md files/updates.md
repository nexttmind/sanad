# Update Summary

> **New agents:** read [`agent-onboarding.md`](./agent-onboarding.md) first — this file is a chronological log.

---

## 2026-06-09 — Donate UX, mobile, daily cap policy, scoring phase 2, security phase C

### Daily cap → admin batches only
- **Migration:** `20260609150000_daily_cap_admin_batches_only.sql`
  - Drops public daily cap trigger; `get_submission_status()` always `accepting: true`
  - `list_submissions()` adds `beirut_date` filter (Asia/Beirut)
- **Frontend:** `src/lib/daily-batch.ts`, `admin.requests.index.tsx` — «دفعة اليوم» panel (50/batch, FIFO by `queue_number`)
- **Public form:** removed `CapReachedMessage` gate and hero stats from `index.tsx`
- **Generator:** `scripts/gen-daily-batch-migration.mjs`

### Donation contacts & donate page overhaul
- **New:** `src/lib/donation-contacts.ts` — Whish `96181432343`, alt `9613689363`
- **`donate.tsx`:** removed adoptable families section, fake bank details, stats ticker
- **Whish block** moved to position after DonationJourney (replaces removed allocate section)
- **Removed:** «اختَر أثرك» amount picker + future receipt card
- **Amount:** entered in `DonationSubmitForm` only (`onAmountChange` prop)
- **Hero:** centered SANAD logo circle above branding (both `/` and `/donate`)
- **Carousel dots:** `DonationJourney.tsx` — RTL-safe active slide detection + glowing clay dot

### Mobile responsiveness (public pages)
- `src/styles.css` — `public-nav-offset`, `touch-target`, safe-area bottom
- `PublicNav`, `PublicFooter`, `index.tsx`, `donate.tsx`, `track.tsx`
- `DonationSubmitForm`, `PublicQrCard`, `DonationJourney`
- Donate ledger: **card layout on mobile**, table on `md+`

### Instagram
- `public-site-config.ts` — `contact.instagram_url`
- `PublicFooter.tsx` — link to @hsaleh94
- `admin.public-settings.tsx` — editable field
- **Migration:** `20260609160000_public_site_config_instagram.sql`

### Scoring v2 phase 2
- **Migration:** `20260609140000_scoring_v2_phase2_reference_financial.sql`
- Reference bump, financial signals, `raw_max` 117, tier distribution RPC, 20 preview samples
- **Phase 1:** `20260609130000_scoring_v2_correctness_and_signals.sql`
- UI: `scoring-config.ts`, `admin.scoring.tsx`, `ScoringTierDistribution.tsx`, `ScoringPreviewPanel.tsx`

### Security hardening (June 9 migrations + edge)
- `20260609100000` — lock `track_queue_position` to service_role
- `20260609100100` — harden `claim_first_admin`
- `20260609110000` — lock `aid_request_files` insert
- `20260609110100` — rate_limit_log retention
- `20260609120000` — distribution PIN six digits
- Edge: fail-closed rate limits on `precheck-aid-submission`, `submit-aid-request`
- **CSP:** enforced in `netlify.toml` (was report-only)
- **Spec:** `security-hardening-spec.md` updated

### Admin UX phase 3b
- Infinite submissions query, quick filter chips, bulk export, lifecycle timeline, alerts menu
- Files: `use-submissions-list-query.ts`, `request-quick-filters.ts`, `AdminAlertsMenu.tsx`, `RequestLifecycleTimeline.tsx`

### Git / deploy
- Commits through `66196f1` on `main` (both `origin` + `mhmdachkar`)
- **209 tests** passing · **build** OK

---

## Earlier updates (2026-06-06 and before)

<details>
<summary>Click to expand historical entries</summary>

- `src/lib/scoring-config.ts` — per-signal weights in scoring config
- `src/routes/admin.scoring.tsx` — weight editing UI
- `src/lib/submissions-list.ts` — `needs[]` filter, keyset cursor
- `supabase/migrations/20260606050000_scoring_config_runtime.sql`
- `supabase/migrations/20260606070000_list_submissions_ops_filters.sql`
- Donation proof gallery, `donation_impact_stats` hero metrics
- Export job signed URLs (`export-job-url` edge function)
- Queue integrity scheduled check
- Rate limits: track, donation, aid submit, upload-id-doc
- Distribution PIN lockout, CORS allowlist on all edge functions
- Public track queue position RPC
- Realtime on admin request detail
- TanStack Query caching for public donation reads
- Extended CSV export columns
- See full list in git history before `39346b4`

</details>

No new dependencies added in June 9 session.
