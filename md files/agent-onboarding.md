# SANAD Aid Connect — Agent Onboarding (read this first)

**Last updated:** 2026-06-09  
**Repo remotes:** `origin` → nexttmind/sanad · `mhmdachkar` → Mhmdachkar/sanad  
**Production:** https://sanadd.co  
**Supabase project:** `lpdjtzwfxsjjudhxinmk`

> **Purpose:** One document so a new chat/agent does **not** need to read the whole codebase. Deep dives live in linked MD files below.

---

## 1. What this product is

Arabic RTL humanitarian aid platform (Lebanon south): families submit aid requests; staff review/score/distribute; donors pledge via Whish and other channels.

| Audience | Main routes |
|----------|-------------|
| Applicants | `/` (form), `/track` |
| Donors | `/donate` |
| Staff | `/admin/*` (JWT + RLS) |

**Stack:** TanStack Start + React + Tailwind · Supabase (Postgres, RLS, Edge Functions) · Netlify deploy.

---

## 2. Current policy decisions (locked — do not revert without user)

| Topic | Decision |
|-------|----------|
| **OTP** | Removed. Phone verified by staff call, not SMS. |
| **Phone uniqueness** | One submission ever per normalized Lebanese phone. |
| **National ID uniqueness** | One submission ever per normalized document number. |
| **Daily intake cap (public)** | **Form always open.** No 50/day block on `/`. |
| **Daily batches (admin)** | Staff review **50 FIFO per Beirut calendar day** by `queue_number` ASC. Filter: `beirut_date` on `list_submissions`. |
| **Whish donations** | `+961 81 432 343` (`96181432343`) |
| **Other donation channels** | Contact `+961 3 689 363` (`9613689363`) — tel + WhatsApp one-click |
| **Adoptable cases on donate** | Removed — no family picker / case list on public donate page |
| **Rate limits** | Fail-closed on edge functions when `check_rate_limit` RPC errors |

---

## 3. Git state (recent commits on `main`)

| Commit | Summary |
|--------|---------|
| `66196f1` | Hero logos centered; Instagram in footer + admin settings |
| `ffb30e1` | Mobile responsiveness (public pages) |
| `b33c863` | Daily cap → admin batches; donation contacts; Whish UI |
| `39346b4` | Security hardening, admin UX phase 3b, scoring v2 phase 2 |

**Tests:** `npm run test` → **209** passing (as of 2026-06-09).  
**Build:** `npm run build` OK.

---

## 4. Migrations to apply on Supabase (order matters)

Apply any missing files in timestamp order. **June 9 batch** (after earlier v2 migrations):

```
20260609100000_lock_track_queue_position.sql
20260609100100_harden_claim_first_admin.sql
20260609110000_lock_aid_request_files_insert.sql
20260609110100_rate_limit_log_retention.sql
20260609120000_distribution_pin_six_digits.sql
20260609130000_scoring_v2_correctness_and_signals.sql
20260609140000_scoring_v2_phase2_reference_financial.sql
20260609150000_daily_cap_admin_batches_only.sql   ← public cap removed; admin beirut_date filter
20260609160000_public_site_config_instagram.sql   ← instagram_url in contact config
```

**Daily cap migration (`150000`) does:**
- Drops `trg_enforce_daily_cap` trigger
- `get_submission_status()` always `accepting: true`
- `check_submission_eligibility()` no longer checks daily cap
- `list_submissions()` adds `beirut_date` filter (Asia/Beirut day bounds)

---

## 5. Edge functions — redeploy after code changes

| Function | Notes |
|----------|-------|
| `precheck-aid-submission` | Fail-closed rate limits; no `reference_code` in duplicate response |
| `submit-aid-request` | Fail-closed rate limits |
| `submit-donation` | CORS (Netlify prod + preview regex) |
| `export-job-url` | CORS |
| `admin-user-management` | CORS |
| `track-request-proxy` | Unchanged recently |
| `upload-id-doc` | Unchanged recently |
| `submission-status` | Unchanged recently |
| `queue-integrity-check` | Unchanged recently |

Deploy: `supabase functions deploy <name>` (see `package.json` scripts).

**CORS:** `supabase/functions/_shared/cors.ts` — production `sanadd.co` / `www.sanadd.co` + Netlify preview regex. CSP enforced in `netlify.toml` (not report-only).

---

## 6. Scoring v2 (SQL, not edge functions)

| Phase | Migration | Highlights |
|-------|-----------|------------|
| Phase 1 | `20260609130000` | Bug fixes (`critical_medication`, `displaced_180d`), new signals, tier sync |
| Phase 2 | `20260609140000` | Reference bump (10/15 mukhtar), financial signals, `raw_max` 117, tier distribution RPC, 20 preview samples |

**Frontend:** `src/lib/scoring.ts`, `src/lib/scoring-config.ts`, `/admin/scoring` (preview panel, tier distribution).

**After migrations:** run bulk recalc from `/admin/scoring`.

---

## 7. Admin UX (phase 3b — shipped)

| Feature | Key files |
|---------|-----------|
| Infinite submissions list | `src/lib/use-submissions-list-query.ts` |
| Quick filter chips | `src/lib/request-quick-filters.ts`, `admin.requests.index.tsx` |
| Bulk export | `ExportSubmissionsModal`, `export-submissions.ts` |
| Lifecycle timeline | `RequestLifecycleTimeline.tsx` |
| Alerts menu | `AdminAlertsMenu.tsx` |
| Daily batch panel | `src/lib/daily-batch.ts`, `admin.requests.index.tsx` — date picker, batch prev/next, 50 per batch, `queue_number` ASC |

**Routes note:** List = `admin.requests.index.tsx`, detail = `admin.requests.$id.tsx` (not monolithic `admin.requests.tsx`).

---

## 8. Public pages — current UI (2026-06-09)

### `/` — Aid request
- Hero: background photo + **centered logo circle** above `S · A · N · A · D — سَنَد`
- **No** daily cap gate (`CapReachedMessage` removed from index)
- **No** hero stats counter grid
- Form: phone + national ID precheck, document upload via `upload-id-doc` edge function

### `/donate`
- Hero: centered logo, Whish CTA → `#methods`
- **Removed:** amount picker / receipt card section («اختَر أثرك» / allocate)
- **Order:** Hero → Promise → DonationJourney → **Methods (Whish)** → Ledger → Pledges → FAQ → CTA
- **Whish block** (replaces allocate position): copy rows + one-click tel/WhatsApp + registration form
- **DonationJourney:** mobile photo carousel with **RTL-safe dot indicators** (active dot glows clay)
- Amount entered in `DonationSubmitForm` only (not preset $25)

### `/track`
- Standard search + timeline; mobile-safe padding (`public-nav-offset`)

### Shared layout
- `PublicNav` — logo in nav circle, safe-area, 44px hamburger
- `PublicFooter` — logo, 2-col tablet grid, **Instagram** link `@hsaleh94`
- `src/lib/donation-contacts.ts` — canonical Whish/alt numbers + `telHref` / `whatsappHref`

### Mobile CSS utilities (`src/styles.css`)
- `.public-nav-offset` — clearance under fixed nav + notch
- `.touch-target` — min 44px tap targets
- `.table-scroll` — horizontal table scroll (ledger desktop only; mobile uses cards)

---

## 9. Public site config (admin-editable)

**Table:** `public_site_config` · **RPC:** `get_public_site_config` / `save_public_site_config`  
**Admin UI:** `/admin/public-settings`  
**Types:** `src/lib/public-site-config.ts`

**Contact block includes:**
- `footer_phone`, `footer_email`, `footer_location`
- `instagram_url` — default `https://www.instagram.com/hsaleh94/?hl=en`

---

## 10. Security model (short)

```
Browser (publishable key only)
  → Edge functions (service role, CORS allowlist, rate limits)
    → Postgres (RLS for staff JWT; locked RPCs for public writes)
```

**Never in client bundle:** `SUPABASE_SERVICE_ROLE_KEY`, `SCHEDULED_FUNCTION_SECRET`.

Full detail: [`security-hardening-spec.md`](./security-hardening-spec.md)

---

## 11. Key file map (where to edit what)

| Task | Start here |
|------|------------|
| Aid form / hero | `src/routes/index.tsx` |
| Donate page | `src/routes/donate.tsx`, `DonationSubmitForm.tsx`, `DonationJourney.tsx` |
| Donation numbers | `src/lib/donation-contacts.ts` |
| Track page | `src/routes/track.tsx`, `src/lib/track-request.ts` |
| Admin list + batches | `src/routes/admin.requests.index.tsx`, `src/lib/daily-batch.ts` |
| Admin request detail | `src/routes/admin.requests.$id.tsx` |
| Scoring | `src/lib/scoring.ts`, `admin.scoring.tsx`, SQL migrations |
| Submissions RPC wrapper | `src/lib/submissions-list.ts` |
| Edge function CORS | `supabase/functions/_shared/cors.ts` |
| Global styles | `src/styles.css` |
| Netlify / CSP | `netlify.toml` |

---

## 12. Commands

```bash
npm run dev          # localhost:8080, HMR
npm run test         # vitest (209 tests)
npm run build        # production + Netlify SSR function
npm run smoke:ship   # live RPC smoke (needs .env)
```

---

## 13. PRD / spec index (read only the one you need)

| Doc | When to read |
|-----|--------------|
| **This file** | Always first |
| [`current situation.md`](./current%20situation.md) | Route inventory + v2 feature status |
| [`prd-phone-uniqueness-daily-cap.md`](./prd-phone-uniqueness-daily-cap.md) | Phone/ID rules — **note daily cap section superseded by §2 above** |
| [`security-hardening-spec.md`](./security-hardening-spec.md) | CORS, rate limits, RLS, secrets |
| [`prd-v2-scoring-queue-ops.md`](./prd-v2-scoring-queue-ops.md) | Scoring, queue, admin list/export |
| [`mobile-responsive-plan.md`](./mobile-responsive-plan.md) | Breakpoints + public page mobile audit |
| [`what-we-achieved.md`](./what-we-achieved.md) | Plain-English feature summary for stakeholders |
| [`updates.md`](./updates.md) | Chronological change log |
| [`netlify-deploy.md`](./netlify-deploy.md) | Deploy env vars |
| [`dev-workflow.md`](./dev-workflow.md) | Local dev vs build |

**Historical / audit:** `phase0-audit-results.md`, `risk-remediation-playbook.md`, `performance-scalability-spec.md`, `submission-limits-implementation-phases.md`

---

## 14. Deploy checklist (operator)

1. Apply all pending migrations (§4) on Supabase SQL editor or `supabase db push`
2. Redeploy edge functions listed in §5
3. Netlify auto-builds on push to `main`
4. Post-deploy smoke:
   - `/` — form submits, no cap block
   - `/donate` — Whish copy, carousel dots swipe, register donation
   - `/track` — lookup works
   - `/admin/requests` — daily batch panel, date filter
   - `/admin/scoring` — bulk recalc if migrations new

---

## 15. Known stale code (harmless)

| Item | Notes |
|------|-------|
| `CapReachedMessage.tsx` | Unused after public cap removed |
| Edge functions still handle `daily_cap_reached` | Never returned after migration `150000` |
| `prd-phone-uniqueness-daily-cap.md` cap sections | Superseded — see §2 |

---

*Maintainers: update this file + [`updates.md`](./updates.md) + [`current situation.md`](./current%20situation.md) whenever shipping multi-file features.*
