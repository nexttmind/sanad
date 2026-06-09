# SANAD — Current Situation

**Last updated:** 2026-06-09  
**Supabase project:** `lpdjtzwfxsjjudhxinmk`  
**Production:** https://sanadd.co  
**Test suite:** 209 Vitest tests passing · production build OK  
**Agent entry point:** [`agent-onboarding.md`](./agent-onboarding.md)

---

## Executive summary

| Area | Status |
|------|--------|
| **v1 PRD (Features 1–12)** | ✅ Complete (OTP removed per phone-uniqueness PRD) |
| **v2 PRD (scoring, queue, admin data)** | ✅ Core + phase 2 scoring shipped |
| **Security hardening** | ✅ Phase C — CSP enforced, fail-closed limits, RPC locks |
| **Admin UX phase 3b** | ✅ Infinite list, filters, export, timeline, alerts, daily batches |
| **Public donate UX** | ✅ Whish-first, no case picker, no amount carousel |
| **Mobile public pages** | ✅ Responsive pass (2026-06-09) |
| **Daily cap** | ✅ **Public open** · **Admin batches of 50/day** (Beirut) |

---

## Policy changes (2026-06-09)

| Before | Now |
|--------|-----|
| Public form blocked at 50 submissions/day | Form **always accepting** |
| Applicants saw cap message | No cap UI on `/` |
| Staff used date-agnostic list only | **دفعة اليوم** — filter by `beirut_date`, batches of 50 by `queue_number` ASC |

Migration: `20260609150000_daily_cap_admin_batches_only.sql`

---

## Routes / pages

| Route | File | Status | Notes |
|-------|------|--------|-------|
| `/` | `index.tsx` | ✅ | No OTP, no cap gate, centered hero logo, precheck + edge submit |
| `/track` | `track.tsx` | ✅ | Proxy + rate limits + optional queue position |
| `/donate` | `donate.tsx` | ✅ | Whish contacts, journey carousel w/ dots, no allocate/cases |
| `/auth` | `auth.tsx` | ✅ | Staff login |
| `/admin` | `admin.tsx` + `AdminShell.tsx` | ✅ | Auth gate |
| `/admin/` | `admin.index.tsx` | ✅ | Overview + realtime |
| `/admin/requests` | `admin.requests.index.tsx` | ✅ | List, filters, export, **daily batch panel** |
| `/admin/requests/$id` | `admin.requests.$id.tsx` | ✅ | Detail, timeline, scoring breakdown |
| `/admin/queue` | `admin.queue.tsx` | ✅ | FIFO, bulk assign, integrity |
| `/admin/scoring` | `admin.scoring.tsx` | ✅ | v2 config, 20-sample preview, tier distribution |
| `/admin/public-settings` | `admin.public-settings.tsx` | ✅ | Track copy, QR, contact + **Instagram URL** |
| `/admin/references` | `admin.references.tsx` | ✅ | Mukhtar whitelist |
| `/admin/distribution` | `admin.distribution.tsx` | ✅ | QR + 6-digit PIN |
| `/admin/analytics` | `admin.analytics.tsx` | ✅ | Aggregates |
| `/admin/users` | `admin.users.tsx` | ✅ | Edge function user mgmt |
| `/admin/audit` | `admin.audit.tsx` | ✅ | Audit log |
| `/admin/donations` | `admin.donations.tsx` | ✅ | Verify pledges |

---

## June 9 migrations (apply in order)

1. `20260609100000_lock_track_queue_position.sql`
2. `20260609100100_harden_claim_first_admin.sql`
3. `20260609110000_lock_aid_request_files_insert.sql`
4. `20260609110100_rate_limit_log_retention.sql`
5. `20260609120000_distribution_pin_six_digits.sql`
6. `20260609130000_scoring_v2_correctness_and_signals.sql`
7. `20260609140000_scoring_v2_phase2_reference_financial.sql`
8. `20260609150000_daily_cap_admin_batches_only.sql`
9. `20260609160000_public_site_config_instagram.sql`

---

## Edge functions (redeploy when changed)

| Function | JWT | Notes |
|----------|-----|-------|
| `precheck-aid-submission` | OFF | Fail-closed limits; duplicate response masks reference |
| `submit-aid-request` | OFF | Fail-closed limits; service_role insert |
| `submit-donation` | OFF | CORS + rate limits |
| `track-request-proxy` | OFF | Track + history + queue position |
| `upload-id-doc` | OFF | MIME/size/path validation |
| `submission-status` | OFF | Cap status (always accepting after migration) |
| `export-job-url` | ON | Signed export URLs |
| `admin-user-management` | ON | Staff CRUD |
| `queue-integrity-check` | OFF | Nightly / manual integrity |

---

## Donation contacts (canonical)

| Channel | Display | E.164 |
|---------|---------|-------|
| Whish | +961 81 432 343 | 96181432343 |
| Other (bank, PayPal, OMT) | +961 3 689 363 | 9613689363 |

Code: `src/lib/donation-contacts.ts` · Footer Instagram: `https://www.instagram.com/hsaleh94/?hl=en`

---

## Key libraries (2026-06-09)

| Path | Purpose |
|------|---------|
| `src/lib/daily-batch.ts` | Beirut date + batch offset math for admin |
| `src/lib/donation-contacts.ts` | Whish/alt phones, tel/WhatsApp hrefs |
| `src/lib/use-submissions-list-query.ts` | Infinite list + daily batch hook |
| `src/lib/request-quick-filters.ts` | Admin quick filter chips |
| `src/lib/scoring.ts` / `scoring-config.ts` | Scoring v2 client |
| `src/lib/submissions-list.ts` | `list_submissions` RPC wrapper |
| `src/lib/public-site-config.ts` | Track/donate/footer copy + instagram_url |

---

## Testing & ship

```bash
npm run test          # 209 tests
npm run build
npm run smoke:ship    # needs .env
```

**Manual smoke:**
1. `/` — submit flow, no cap block
2. `/donate` — Whish copy, swipe photos (dots update), register pledge
3. `/admin/requests` — daily batch panel
4. `/admin/scoring` — preview + bulk recalc after new migrations

---

## Still optional / backlog

| Item | Notes |
|------|-------|
| Remove dead `CapReachedMessage.tsx` | Harmless unused component |
| Stale `daily_cap_reached` paths in edge | Never hit after migration |
| Playwright visual regression | See `mobile-responsive-plan.md` |
| Excel export | Async CSV only today |

---

*See also: [`agent-onboarding.md`](./agent-onboarding.md), [`what-we-achieved.md`](./what-we-achieved.md), [`updates.md`](./updates.md)*
