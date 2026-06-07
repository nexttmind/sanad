# PRD — Phone + National ID Uniqueness + Daily Cap (No OTP)

**Status:** Production-ready for phased implementation (v1.1 — national ID + production audit)  
**Source plan:** `.cursor/plans/phone_limits_no_otp_3b909e93.plan.md`  
**Supersedes:** PRD Feature 2 (OTP Phone Verification) in [`prd.md`](./prd.md) — OTP is removed, not built.

---

## Problem

Applicants can submit multiple aid requests with the same phone number in different formats (`+961 70…`, `03 70…`, spaces/dashes). There is no daily intake limit. SMS OTP adds friction; staff verify applicants by phone call instead.

**Multi-family households:** One home may contain several families. Phone-only rules cannot distinguish families — only **phone numbers** and **identity document numbers**. Each family must use their **own mobile number** and **own document number** to submit once.

## Solution

| Rule | Behavior |
|------|----------|
| **Phone** | One submission **ever** per normalized Lebanese phone |
| **National ID / document number** | One submission **ever** per normalized `national_id` — the **unique code printed on the ID card or passport** (رقم الوثيقة) |
| **Daily cap** | **50** new requests per calendar day (`Asia/Beirut`); form disabled when reached |
| **OTP** | **Removed** entirely (UI, edge function, submit gate) |
| **Device / IP** | Analytics only — **no** blocking |

### How three families in one home can each submit once

The app does **not** detect “families” or “households.” It enforces uniqueness on **two identifiers**:

| Family | Phone | Document number | Result |
|--------|-------|-----------------|--------|
| A | 96170111111 | ID `12345678` | Allowed (first time) |
| B | 96170222222 | ID `87654321` | Allowed (different phone + different ID) |
| C | 96170333333 | ID `11223344` | Allowed |
| B tries again | same as A’s phone | any ID | **Blocked** — `phone_already_submitted` |
| B tries again | new phone | same as A’s ID | **Blocked** — `id_already_submitted` |
| All share one phone | one shared mobile | three different IDs | **Only one** can submit — phone uniqueness wins first |

Staff follow-up calls remain the backstop for verifying names and situations.

## Success criteria

- [ ] Same phone in any common format → blocked as duplicate (precheck + submit + DB)
- [ ] Same document number (spaces/dashes ignored, case-insensitive) → blocked as duplicate
- [ ] Invalid document code for selected type → blocked at form **and** server (400)
- [ ] Only **Lebanese ID** or **Passport** accepted as document type
- [ ] Three families with three phones + three IDs → three separate allowed submissions
- [ ] 51st submission on a given Beirut day → blocked (`daily_cap_reached`)
- [ ] Form hidden/disabled on page load when cap reached
- [ ] Duplicate phone **or** ID shows Arabic message + link to `/track`
- [ ] OTP UI and server checks gone; `send-otp` removed from deploy scripts
- [ ] Production deploy unchanged except new migration + edge functions + frontend

## Decisions locked (2026-06-07)

| Question | Decision |
|----------|----------|
| Multi-family households | **Phone + national_id** — each person uses own phone + own document number |
| National ID normalization | **Strip spaces/dashes; uppercase** — uniqueness key after format validation |
| Document types (form) | **Lebanese ID + Passport only** — remove family record / extract / other |
| Lebanese ID format | **Digits only, 7–8 digits** after stripping non-digits (e.g. `12345678`) |
| Passport format | **2 letters + 7 digits** after normalize (e.g. `RL1234567`; spaces/dashes stripped, uppercased) |
| Input validation scope | **Client (blur/submit) + server (400)** — mirror rules on `submit-aid-request` and `precheck-aid-submission` |
| `document_type` at submit | **Required** — stored on row; drives format validation for `national_id` |
| Resubmit after rejection? | **No** — one phone **and** one ID = one submission ever |
| Show slot counter when open? | **No** — hide “X of 50” |
| Cap reached UI | **Full page** — replace form with `CapReachedMessage` |
| Duplicate precheck | **Block submit button** when duplicate phone **or** ID detected |
| OTP | **Removed** |
| Daily cap | **50 / Asia/Beirut** |
| Cursor rules install | **Done** — `.cursor/rules/*.mdc` |
| Fail-open if status API fails | **Yes** — form stays up; cap still enforced at submit/DB |
| Precheck trigger | **On blur** (phone field; document number field) |
| Masked reference on duplicate | **Last 4 chars visible** (e.g. `****-1234`) |
| `national_id` required at submit | **Yes** — form already requires رقم الوثيقة; server returns 400 if missing |

---

## Phase overview (implementation order)

| Phase | Name | Depends on | Ship alone? |
|-------|------|------------|-------------|
| **0** | Pre-flight | — | Yes (no code) |
| **1** | Database migration | Phase 0 audits | Yes (backend-only) |
| **2** | TS normalizers + tests | Phase 1 | Yes |
| **3** | Edge functions | Phase 1 | Yes (with 1) |
| **4** | Frontend | Phase 2 + 3 | No — needs 1+3 |
| **5** | Automated tests | Phase 2–4 | No |
| **6** | Production deploy | Phase 1–5 | Final |

**Rule:** Deploy order = **migration → edge functions → frontend (Netlify)**. Never deploy frontend before migration and edge functions are live.

---

## Production readiness checklist (all must pass before Phase 6)

- [x] Phase 0 duplicate audits run; remediation documented
- [ ] Migration tested on staging (phone, ID, cap, track RPCs)
- [ ] `npm test` passes
- [ ] `npm run build` passes (TanStack/Netlify)
- [ ] Edge functions deployed; Supabase function logs clean
- [ ] New functions reachable from production origin (CORS / `ALLOWED_ORIGINS`)
- [ ] `npm run types:gen` run if migration adds columns used in TS
- [ ] Smoke tests (Phase 6) passed on staging then production
- [ ] Rollback plan documented (see Phase 6)

---

## Implementation workflow (mandatory)

**Before touching any file in this PRD:**

1. Read the **File spec** section for that file below.
2. Agent must **grill** (ask clarifying questions) until you confirm the spec — see [Alignment questions](#alignment-questions-grill-before-each-phase).
3. Only then implement that file (or phase).
4. Mark the step `[x]` in this PRD when done.

Cursor rules enforcing this: see [Cursor rules (install)](#cursor-rules-install) below.

---

## Phase 0 — Pre-flight (no code)

| Step | Action | Owner sign-off |
|------|--------|----------------|
| 0.0 | Install Cursor rules (`.cursor/rules/implementation-alignment.mdc`, `phone-uniqueness-daily-cap.mdc`) | [x] |
| 0.1 | Run duplicate audits — see [`phase0-audit-results.md`](./phase0-audit-results.md) | [x] |
| 0.2 | Remediation if duplicates: keep oldest `created_at` per phone / per ID; document in migration comments | [x] (N/A — no duplicates) |
| 0.3 | Arabic copy confirmed (section below) | [x] |
| 0.4 | Fail-open on status fetch confirmed | [x] |
| 0.5 | Slot counter hidden | [x] |

### Audit SQL (run before Phase 1)

```sql
-- Duplicate phones (after computing normalized form in query)
SELECT
  regexp_replace(
    CASE
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^961' THEN regexp_replace(phone, '[^0-9]', '', 'g')
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0' THEN '961' || substring(regexp_replace(phone, '[^0-9]', '', 'g') FROM 2)
      ELSE '961' || regexp_replace(phone, '[^0-9]', '', 'g')
    END, '[^0-9]', '', 'g'
  ) AS phone_normalized,
  COUNT(*) AS cnt,
  string_agg(reference_code, ', ' ORDER BY created_at) AS codes
FROM aid_requests
GROUP BY 1
HAVING COUNT(*) > 1;

-- Duplicate national IDs (non-null)
SELECT
  upper(regexp_replace(national_id, '[\s\-]', '', 'g')) AS id_normalized,
  COUNT(*) AS cnt,
  string_agg(reference_code, ', ' ORDER BY created_at) AS codes
FROM aid_requests
WHERE national_id IS NOT NULL AND trim(national_id) <> ''
GROUP BY 1
HAVING COUNT(*) > 1;
```

Also review existing `queue_integrity_check` report field `duplicate_phones_pending`.

---

## Phase 1 — Database migration

**File:** `supabase/migrations/20260608100000_phone_uniqueness_daily_cap.sql`

### File spec (review before implementing)

| Item | Spec |
|------|------|
| **Purpose** | Canonical phone + national_id columns, uniqueness, daily cap, RPCs, track updates |
| **Creates** | `normalize_lebanese_phone()`, `normalize_national_id()`, `validate_document_number()`, `beirut_day_start()`, `submissions_today_count()`, columns `phone_normalized`, `national_id_normalized`, **`document_type`**, triggers, unique indexes, RPCs |
| **Phone normalization** | Strip non-digits; if `961…` keep; if `0…` → `961` + rest; else → `961` + digits |
| **ID normalization** | After format pass: strip spaces/dashes; `upper()` — case-insensitive uniqueness |
| **ID format validation** | `validate_document_number(document_type, raw)` in SQL + mirrored in TS — **Lebanese ID:** 7–8 digits; **Passport:** `^[A-Z]{2}[0-9]{7}$` after normalize |
| **document_type column** | `TEXT NOT NULL` on new rows; values `lebanese_id` \| `passport`; CHECK constraint |
| **Unique indexes** | `phone_normalized`; `national_id_normalized` WHERE NOT NULL AND trim <> '' |
| **Daily cap** | Constant `50`; `BEFORE INSERT` trigger + `pg_advisory_xact_lock` per Beirut date |
| **Triggers** | (1) `set_phone_normalized` on INSERT/UPDATE of phone; (2) `set_national_id_normalized` on INSERT/UPDATE of national_id; (3) `enforce_daily_cap` BEFORE INSERT |
| **national_id required** | Eligibility RPC returns `allowed=false` if `_national_id` null/blank **or format invalid**; submit edge returns 400 with Arabic field error |
| **Masked reference** | `upper(reference_code)` masked: all but last 4 chars → `*` |
| **Grants** | `get_submission_status` → anon, authenticated; `check_submission_eligibility` → service_role only (`REVOKE` from PUBLIC) |
| **Types** | After apply: run `npm run types:gen` and commit updated `src/integrations/supabase/types.ts` |
| **RPC `get_submission_status`** | `SECURITY DEFINER`, `SET search_path = public`, grant `anon`, `authenticated` |
| **RPC `check_submission_eligibility(_phone, _national_id)`** | service_role only; order: **cap → phone → national_id**; masked `existing_reference_code` on match |
| **Track** | Update `track_request`, `track_request_history` to use `normalize_lebanese_phone` |
| **Analytics** | Non-unique indexes on `ip_hash`, `device_fingerprint` |
| **Does not** | Drop `phone_verifications`; device/IP unique indexes |

| Step | Done |
|------|------|
| 1.1 Write migration SQL | [ ] |
| 1.2 Test on staging: backfill, phone duplicate, ID duplicate, cap at 50, track match | [ ] |
| 1.3 Run `npm run types:gen` | [ ] |
| 1.4 Apply to production (`supabase db push`) | [ ] |

---

## Phase 2 — Shared normalizers + validation (TS)

### 2a — `src/lib/phone-normalize.ts`

| Item | Spec |
|------|------|
| **Exports** | `normalizeLebanesePhone()`, `normalizeNationalId()` — must match SQL |
| **Tests** | Phone + ID format pairs; cross-format equivalence |
| **Used by** | track UI, precheck/submit helpers; edge functions mirror same logic inline |

| Step | Done |
|------|------|
| 2.1 Create `phone-normalize.ts` | [ ] |
| 2.2 Add unit tests | [ ] |

### 2b — `src/lib/aid-request-validation.ts` (new)

| Item | Spec |
|------|------|
| **Purpose** | Single source of truth for **all** public submit field rules — used by form and mirrored on edge |
| **Exports** | `DOCUMENT_TYPES`, `validateDocumentNumber(type, raw)`, `validateAidRequestFields(body)` → `{ ok, errors: Record<string, string> }` |
| **Document types** | `lebanese_id` (بطاقة الهوية اللبنانية), `passport` (جواز السفر) — **only these two** |
| **Lebanese ID** | After strip non-digits: `/^\d{7,8}$/` |
| **Passport** | After strip spaces/dashes + upper: `/^[A-Z]{2}\d{7}$/` |
| **Phone** | Same as existing `isLebPhone` (03/70/71/76/78/79/81 + 6 digits) |
| **All fields** | Mirror current `index.tsx` rules: names, family counts, displaced conditional, needs, reference, doc file presence (client only for file) |
| **Edge mirror** | `submit-aid-request` and `precheck-aid-submission` duplicate validation logic inline (Deno cannot import TS from `src/` — keep regex/constants in sync; test both) |

| Step | Done |
|------|------|
| 2b.1 Create `aid-request-validation.ts` | [ ] |
| 2b.2 Add unit tests (`aid-request-validation.test.ts`) | [ ] |
| 2b.3 Extract inline validators from `index.tsx` into shared module | [ ] |

---

## Phase 3 — Edge functions

### 3a — `supabase/functions/submission-status/index.ts` (new)

| Item | Spec |
|------|------|
| **Method** | GET/POST |
| **Auth** | Anon key; no user session |
| **CORS** | Same pattern as `submit-aid-request` |
| **Body** | None required |
| **Response** | `{ accepting, daily_count, daily_limit, message_ar? }` from RPC |

| Step | Done |
|------|------|
| 3a.1 Implement function | [ ] |
| 3a.2 Add `functions:deploy:submission-status` to `package.json` | [ ] |
| 3a.3 Verify CORS: production URL in Supabase `ALLOWED_ORIGINS` | [ ] |

### 3b — `supabase/functions/precheck-aid-submission/index.ts` (new)

| Item | Spec |
|------|------|
| **Input** | `{ phone: string, national_id?: string, document_type?: string }` |
| **Logic** | Validate format → normalize → `check_submission_eligibility(_phone, _national_id)` via service role |
| **When (client)** | Phone valid → phone only; document type + number filled → phone + national_id + format check |
| **Output** | `{ allowed, reason?, message_ar?, reference_code? }` — no insert |
| **No OTP** | Must not check `phone_verifications` |

| Step | Done |
|------|------|
| 3b.1 Implement function | [ ] |
| 3b.2 Add `functions:deploy:precheck-aid-submission` to `package.json` | [ ] |
| 3b.3 Update aggregate `functions:deploy` script to include new functions; remove `send-otp` | [ ] |

### 3c — `supabase/functions/submit-aid-request/index.ts` (modify)

| Item | Spec |
|------|------|
| **Remove** | `hasRecentPhoneVerification`, `OTP_VERIFIED_WINDOW_HOURS`, 403 OTP response |
| **Insert** | `phone_verified: false`; include `document_type`; triggers set normalized columns |
| **Validate** | **Full payload** — mirror `aid-request-validation.ts` rules inline; 400 + `{ ok: false, errors: { field: message_ar } }` |
| **Validate** | 400 if phone, national_id, or **document_type** missing/blank/invalid format |
| **Before insert** | Call `check_submission_eligibility(phone, national_id)`; 409 if blocked |
| **On insert error** | Map `23505` on `phone_normalized` or `national_id_normalized` → correct reason code |
| **409 body** | `{ ok: false, reason, message, reference_code? }` |
| **Normalize** | Same rules as SQL (duplicate `normalizePhone` locally or shared constant) |

| Step | Done |
|------|------|
| 3c.1 Update submit-aid-request | [ ] |
| 3c.2 Deploy all three functions | [ ] |

### 3d — `supabase/functions/track-request-proxy/index.ts` (modify)

| Item | Spec |
|------|------|
| **Change** | Use same normalization as SQL before track RPC |

| Step | Done |
|------|------|
| 3d.1 Align normalizer | [ ] |

### 3e — Delete `supabase/functions/send-otp/index.ts`

| Step | Done |
|------|------|
| 3e.1 Delete send-otp | [ ] |
| 3e.2 Remove from `functions:deploy` and `functions:deploy:otp` in `package.json` | [ ] |

---

## Phase 4 — Frontend

### 4a — `src/lib/submission-status.ts` (new)

| Item | Spec |
|------|------|
| **API** | `getSubmissionStatus()` via `supabase.functions.invoke('submission-status')` |
| **Types** | `SubmissionStatus { accepting, daily_count, daily_limit, message_ar? }` |

### 4b — `src/lib/precheck-aid-submission.ts` (new)

| Item | Spec |
|------|------|
| **API** | `precheckAidSubmission({ phone, national_id? })` |
| **When called** | After phone valid; again when document number (section 06) is filled |

### 4c — `src/components/DuplicateSubmissionAlert.tsx` (new)

| Item | Spec |
|------|------|
| **Props** | `reason: 'phone_already_submitted' \| 'id_already_submitted'`, `message`, `referenceCode?` |
| **UI** | Persistent alert above form; track CTA; RTL; SANAD tokens |

### 4d — `src/components/CapReachedMessage.tsx` (new)

| Item | Spec |
|------|------|
| **Props** | `message?`, `dailyCount?` |
| **UI** | SANAD tokens (same patterns as request form); RTL; link to `/track` |
| **No** | SolidJS patterns; generic amber Tailwind from draft plan |

### 4e — `src/routes/index.tsx` (modify)

| Item | Spec |
|------|------|
| **Remove** | `PhoneOtpSection`, `phoneVerified`, OTP validation error |
| **Add** | Status fetch on mount; **full-page** cap gate (no slot counter) |
| **Add** | Precheck on valid phone; precheck again when **document type + number** filled; block submit on duplicate phone **or** ID **or** invalid format |
| **Change** | `DOC_TYPES` → Lebanese ID + Passport only; validate `docNumber` on blur using `validateDocumentNumber` |
| **Change** | Import validators from `aid-request-validation.ts`; replace inline validation block |
| **Add** | `DuplicateSubmissionAlert`; disable submit when precheck fails or cap closed |

| Step | Done |
|------|------|
| 4.1 Lib helpers + CapReachedMessage + DuplicateSubmissionAlert | [ ] |
| 4.2 index.tsx integration (status, precheck, submit errors) | [ ] |
| 4.3 track.tsx normalizer | [ ] |
| 4.4 submit-aid-request.ts result types | [ ] |
| 4.5 Remove OTP files | [ ] |
| 4.6 Manual UI check in dev | [ ] |

### 4f — `src/lib/submit-aid-request.ts` (modify)

| Item | Spec |
|------|------|
| **Result type** | Add `reason?: 'phone_already_submitted' \| 'id_already_submitted' \| 'daily_cap_reached'`, `reference_code?` |

### 4g — `src/routes/track.tsx` (modify)

| Item | Spec |
|------|------|
| **Change** | Import `normalizeLebanesePhone` from `phone-normalize.ts` |

### 4h — Delete OTP frontend

| File | Action |
|------|--------|
| `src/components/PhoneOtpSection.tsx` | Delete |
| `src/lib/phone-otp.ts` | Delete |
| `src/lib/__tests__/phone-otp.test.ts` | Delete |
| `src/lib/__tests__/phone-otp.integration.test.ts` | Delete |

| Step | Done |
|------|------|
| 4h.1 Delete OTP component, lib, tests | [ ] |

### 4i — Admin (optional)

**File:** `src/components/admin/EditableRequestSections.tsx` — hide or label `phone_verified` as deprecated.

---

## Phase 5 — Tests

| File | Spec |
|------|------|
| `phone-normalize.test.ts` | Phone + ID format equivalence |
| `submission-status.test.ts` | Accepting / cap reached |
| `precheck-aid-submission.test.ts` | Phone duplicate, ID duplicate, allowed |
| `submit-aid-request.integration.test.ts` | All three 409 reason codes |
| Edge function manual/smoke | Invoke each function with curl or Supabase dashboard |

| Step | Done |
|------|------|
| 5.1 Client unit/integration tests | [ ] |
| 5.2 `npm test` green | [ ] |
| 5.3 `npm run build` green | [ ] |

---

## Phase 6 — Deploy and smoke (production)

### Deploy sequence (strict order)

1. **Migration** — `supabase db push` (or CI migration step)
2. **Edge functions** — `submission-status`, `precheck-aid-submission`, `submit-aid-request` (do not redeploy `send-otp`)
3. **Frontend** — push to main / Netlify production build
4. **Verify** — smoke checklist below

### Rollback notes

| Layer | Rollback |
|-------|----------|
| Frontend | Revert Netlify deploy to previous build |
| Edge functions | Redeploy previous `submit-aid-request`; remove new function routes from client (requires frontend revert too) |
| Migration | **Hard** — do not drop unique indexes in prod without DBA plan; prefer forward-fix. Test migration on staging first. |

| Step | Done |
|------|------|
| 6.1 Migration applied to production | [ ] |
| 6.2 Edge functions deployed | [ ] |
| 6.3 `npm run build` + Netlify deploy | [ ] |
| 6.4 Smoke: first submit OK | [ ] |
| 6.5 Smoke: duplicate phone (different format) blocked | [ ] |
| 6.6 Smoke: duplicate ID (spaces/dashes) blocked | [ ] |
| 6.6b Smoke: invalid ID format rejected (400) | [ ] |
| 6.6c Smoke: invalid passport format rejected (400) | [ ] |
| 6.7 Smoke: three distinct phone+ID pairs allowed | [ ] |
| 6.8 Smoke: track with formatted phone + reference code | [ ] |
| 6.9 Smoke: cap closes form (or simulate 50 rows) | [ ] |
| 6.10 Monitor Supabase function logs 24h | [ ] |

---

## Arabic copy (locked unless you say otherwise)

| Scenario | Message |
|----------|---------|
| Daily cap (page) | نعتذر — وصلنا إلى الحد اليومي لاستقبال الطلبات (٥٠ طلباً). سنعود لاستقبال طلبات جديدة غداً. إذا قدّمت طلباً سابقاً، يمكنك متابعته من صفحة التتبّع. |
| Duplicate phone | سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف. |
| Duplicate ID | سبق أن قُدّم طلب بهذه الوثيقة. يُسمح بطلب واحد فقط لكل رقم وثيقة. |
| Invalid Lebanese ID | رقم الهوية يجب أن يكون ٧ أو ٨ أرقام. |
| Invalid passport | رقم الجواز يجب أن يكون حرفين متبوعين بـ ٧ أرقام (مثال: RL1234567). |
| Invalid document type | يرجى اختيار نوع الوثيقة: بطاقة هوية لبنانية أو جواز سفر. |
| Generic error | حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى. |
| Slots open (optional) | ~~متاح اليوم: {count} من ٥٠ طلباً~~ **Not used** (decision: hide counter) |

---

## Alignment questions (grill before each phase)

Most decisions are **locked** above. Agent asks only if something is still open or contradicts the PRD.

### Still confirm at Phase 0

1. Results of duplicate audit — any rows to remediate?
2. Staging vs production: apply migration to staging first?

### Phase 1 (if audit found duplicates)

1. Confirm keep-oldest remediation per phone and per ID?

### Phase 4 (if UX unclear)

1. Duplicate alert placement — directly under phone field vs top of form? (Default: under relevant field)

### Locked — do not re-ask

- OTP removed; phone + ID uniqueness; no resubmit after rejection; full-page cap; block submit on duplicate; fail-open status; no slot counter; blur precheck; masked reference last-4; **Lebanese ID 7–8 digits; passport 2L+7D; ID+passport only; client+server validation**

---

## Out of scope (v1)

- Dropping `phone_verifications` table
- Device/IP uniqueness
- Phone-only track (still code + phone)
- Admin-tunable daily cap

---

## File index (quick reference)

| File | Phase | New/Mod/Del |
|------|-------|-------------|
| `supabase/migrations/20260608100000_phone_uniqueness_daily_cap.sql` | 1 | New |
| `src/integrations/supabase/types.ts` | 1 | Mod (generated) |
| `src/lib/phone-normalize.ts` | 2a | New |
| `src/lib/__tests__/phone-normalize.test.ts` | 2a | New |
| `src/lib/aid-request-validation.ts` | 2b | New |
| `src/lib/__tests__/aid-request-validation.test.ts` | 2b | New |
| `supabase/functions/submission-status/index.ts` | 3a | New |
| `supabase/functions/precheck-aid-submission/index.ts` | 3b | New |
| `supabase/functions/submit-aid-request/index.ts` | 3c | Mod |
| `supabase/functions/track-request-proxy/index.ts` | 3d | Mod |
| `supabase/functions/send-otp/index.ts` | 3e | Del |
| `src/lib/submission-status.ts` | 4a | New |
| `src/lib/precheck-aid-submission.ts` | 4b | New |
| `src/components/CapReachedMessage.tsx` | 4d | New |
| `src/components/DuplicateSubmissionAlert.tsx` | 4c | New |
| `src/routes/index.tsx` | 4e | Mod |
| `src/lib/submit-aid-request.ts` | 4f | Mod |
| `src/routes/track.tsx` | 4g | Mod |
| `src/components/PhoneOtpSection.tsx` | 4h | Del |
| `src/lib/phone-otp.ts` | 4h | Del |
| `src/lib/__tests__/submission-status.test.ts` | 5 | New |
| `src/lib/__tests__/precheck-aid-submission.test.ts` | 5 | New |
| `.cursor/rules/*.mdc` | 0 | New |
| `package.json` | 3 | Mod |

---

## Cursor rules (install)

Copy these into `.cursor/rules/` as `.mdc` files (requires Agent mode or manual copy):

### `implementation-alignment.mdc` (always apply)

```markdown
---
description: Require file specs and user alignment before implementing changes
alwaysApply: true
---

# Implementation alignment — spec first, grill always

When implementing features (especially multi-file work like migrations, edge functions, and UI):

## Before editing ANY file

1. **Read the file spec** in the active PRD (e.g. `md files/prd-phone-uniqueness-daily-cap.md`) for that path.
2. **State the spec** in one short paragraph: purpose, inputs/outputs, must-nots.
3. **Grill the user** — ask 1–3 targeted questions if anything is ambiguous, contradicts the PRD, or affects UX/policy. Do not guess on:
   - Product policy (caps, uniqueness rules, rejected resubmits)
   - Arabic copy or user-facing behavior
   - Fail-open vs fail-closed
   - Delete vs deprecate
4. **Wait for confirmation** before writing code, unless the user explicitly said "execute the plan" and the PRD already locks that decision.

## During implementation

- One phase or one logical file group at a time; mark PRD checkboxes when done.
- Do not expand scope beyond the spec without asking.
- Match existing project conventions (React not Solid, SANAD tokens, `supabase.functions.invoke` patterns).

## After each phase

- Summarize what changed and what to smoke-test.
- Ask if the next phase spec looks correct before continuing.

## If no PRD exists for the task

- Propose a minimal file spec inline and get approval before coding.
```

### `phone-uniqueness-daily-cap.mdc` (file-scoped)

```markdown
---
description: Phone uniqueness + daily cap feature context (no OTP)
globs: supabase/migrations/*phone*.sql,supabase/functions/submit-aid-request/**,supabase/functions/submission-status/**,supabase/functions/precheck-aid-submission/**,src/routes/index.tsx,src/routes/track.tsx,src/lib/phone-normalize.ts,src/lib/submission-status.ts,src/lib/precheck-aid-submission.ts,src/lib/submit-aid-request.ts,src/components/CapReachedMessage.tsx
alwaysApply: false
---

# Phone uniqueness + daily cap (no OTP)

**PRD:** `md files/prd-phone-uniqueness-daily-cap.md`

## Policy

- One submission ever per normalized Lebanese phone **and** normalized national_id
- 50 submissions per Asia/Beirut day; form disabled when cap reached
- No OTP. No device/IP uniqueness.
- Phone + national_id required at submit; eligibility checks both

## Before editing files in this feature

1. Open the PRD file spec for this path.
2. Grill the user on any open product questions.
3. Implement only after confirmation.

See PRD for normalization table, error codes, and enforcement layers.
```

Also saved as plain markdown copies: [`cursor-rule-implementation-alignment.md`](./cursor-rule-implementation-alignment.md), [`cursor-rule-phone-uniqueness.md`](./cursor-rule-phone-uniqueness.md).
