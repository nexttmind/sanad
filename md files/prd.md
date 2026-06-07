# PRD — SANAD Missing Features
## What Needs to Be Built

This document covers only what is not yet implemented.
Everything that already works is documented in role.md.
Implementation priority order is listed at the bottom.

---

## Feature 1 — Admin Authentication

### What needs to exist

A login page at /auth with email and password inputs and a submit button.
An auth context that stores the current session and the admin's role.
A protected layout that wraps all /admin routes and redirects to /auth if no session exists.
A logout button in the admin sidebar that calls supabase.auth.signOut.

### Acceptance criteria

Navigating to any /admin route without a session redirects to /auth.
After successful login the user is redirected to /admin.
The admin's name and role appear in the sidebar from the real user_roles table.
Logging out destroys the session and redirects to /auth.
The Supabase client sends the JWT on every subsequent request automatically.

### Notes

Use supabase.auth.signInWithPassword.
After login query user_roles where user_id matches auth.uid() to get the role.
Store the role in React context so every admin page can read it.
The claim_first_admin RPC exists to bootstrap the first admin account — document how to call it.

---

## Feature 2 — OTP Phone Verification

> **SUPERSEDED** — See [`prd-phone-uniqueness-daily-cap.md`](./prd-phone-uniqueness-daily-cap.md).  
> OTP is **removed**. Phone uniqueness + 50/day cap replace SMS verification. Do not implement this feature.

### What needs to exist (historical — do not build)

A step in the public form that appears after the user enters their primary phone number.
A send OTP button that triggers an SMS to the entered number.
A 6-digit code input field with a verify button.
A resend option with a 60-second cooldown.
The form cannot be submitted until phone_verified is true.

### Acceptance criteria

OTP is sent via the existing verify_phone_otp RPC in the database.
A real SMS is delivered using Twilio — credentials stored in environment variables.
Wrong code shows a friendly Arabic error with remaining attempts count.
Expired code (after 10 minutes) shows an expiry message.
After 5 failed attempts the OTP is invalidated and a new one must be requested.
phone_verified is set to true in the form state and submitted as true to the database.
The trust score +20 phone_verified bonus fires correctly after this is implemented.

### SMS Provider Setup

Add these to .env:
VITE_TWILIO_ACCOUNT_SID
VITE_TWILIO_AUTH_TOKEN
VITE_TWILIO_PHONE_NUMBER

Because there are no edge functions, send the SMS from a Supabase Edge Function named send-otp that is called from the frontend.

---

## Feature 3 — Admin Actions on Submission Detail

### 3a — Tag Assignment

A tags section on the submission detail page.
Shows all tags currently applied to this submission.
A dropdown or popover to add a tag from the existing tags table.
An X button to remove a tag.

Acceptance criteria:
Reads from tags table (select id, name, color).
Reads from request_tags where request_id matches.
Insert into request_tags on add.
Delete from request_tags on remove.
Changes appear immediately without page refresh.

---

### 3b — Assign to Reviewer

A dropdown on the submission detail page showing all active admin users from user_roles.
Selecting a reviewer updates aid_requests.assigned_to with that user's id.
The assigned reviewer's name appears on the submission row in the list page.

Acceptance criteria:
Reads from user_roles joined with auth.users to get names.
Updates aid_requests.assigned_to.
Assigned name is visible in the list view.

---

### 3c — Contact Reference Action

A section on the submission detail page for the reference person.
Four action buttons: confirmed, denied, no answer, wrong number.
After clicking, the result is saved and a contact notes textarea appears.

Acceptance criteria:
The aid_requests table needs a reference_contact_result column (varchar) and reference_contacted_at (timestamptz) and reference_contact_notes (text) and reference_contacted_by (uuid) — add these via migration.
Clicking a button updates these columns.
If result is confirmed: trigger calculate_scores RPC (reference confirmed adds +30 to trust score).
If result is denied: trust score is penalized — trigger calculate_scores RPC.
Result and timestamp display permanently on the detail page.

---

### 3d — Verify Document Action

A verify button and a reject button visible on the document section of the submission detail.
Reject requires a written reason.

Acceptance criteria:
The aid_request_files table needs doc_admin_verified (boolean) and doc_verified_by (uuid) and doc_verified_at (timestamptz) and doc_rejection_reason (text) — add via migration.
Clicking verify updates these fields.
Clicking reject shows a reason input then updates.
Verification status is visible on the detail page and in the list row.

---

### 3e — Resolve Fraud Event

Each fraud flag on the submission detail page has a resolve button.
Clicking opens a small input for a resolution note then saves.

Acceptance criteria:
Reads from fraud_events where request_id matches and is_resolved is false.
Update fraud_events.is_resolved to true, resolved_by to auth.uid(), resolved_at to now(), resolution_note to the entered text.
After resolving, trigger calculate_scores RPC.
Resolved flags move to a separate collapsed list.

---

## Feature 4 — Audit Log Writes

Every admin action must write a row to the audit_log table.

### Actions to log

Status change: action = 'status_change', old_value = {status: old}, new_value = {status: new}
Note added: action = 'note_added', new_value = {content: note text}
Document verified: action = 'document_verified'
Document rejected: action = 'document_rejected', new_value = {reason: text}
Reference contacted: action = 'reference_contacted', new_value = {result: result}
Fraud flag resolved: action = 'fraud_resolved', new_value = {flag_code: code, note: text}
Tag added: action = 'tag_added', new_value = {tag: name}
Tag removed: action = 'tag_removed', new_value = {tag: name}
Reviewer assigned: action = 'reviewer_assigned', new_value = {reviewer_id: id}
Score recalculated: action = 'score_recalculated'
Export CSV: action = 'export_csv', metadata = {filters: applied filters}

### Acceptance criteria

Every action above writes to audit_log with: submission_id, admin_id (from auth.uid()), action, old_value, new_value, metadata, ip_address (from window location or request header).
The audit log page at /admin/audit reads real rows from this table.
Rows are ordered by performed_at descending.
Date range filter and action type filter work against real data.

---

## Feature 5 — Mukhtar Whitelist Page

Wire /admin/references to real data from mukhtar_whitelist.

### What needs to work

Table reads from mukhtar_whitelist ordered by created_at descending.
Search input filters by full_name or phone.
Region and reference type dropdowns filter results.
Add new reference button opens a form that inserts into mukhtar_whitelist with is_verified false.
Each row has a verify button that sets is_verified true, verified_by to auth.uid(), verified_at to now(), and opens a notes input.
Each row has a deactivate button that sets is_active false and requires a reason.

### Acceptance criteria

All four mock rows are replaced by real database rows.
Add, verify, and deactivate all persist to the database.
times_referenced column is displayed — this is incremented by the existing DB trigger when a new submission references this phone.

---

## Feature 6 — Distribution Management

Wire /admin/distribution to real data from distribution_events and qr_completions.

### Events management

Table reads from distribution_events.
Create event button inserts a new row with name, location, scheduled_at, notes.
Clicking an event shows all aid_requests where status is approved.

### QR Scanner

A working QR scanner view.
Install jsQR or html5-qrcode library.
Camera permission request on open.
After a QR code is decoded from camera: extract submission_id from the payload format SANAD:{ref_code}:{id}:{date}.
Query aid_requests for that id where status is approved.
If not found or not approved: show error.
Check qr_completions for an existing completed row — if found show duplicate warning with previous location and time.
If first scan: show applicant name, family size, needs. Show PIN input field.
Admin enters PIN. Compare to aid_requests.qr_pin.
If PIN matches: insert into qr_completions (submission_id, completed true, completed_by, collection_location, scanned_at), update aid_requests.status to distributed.
Show success confirmation.

### Acceptance criteria

Real events from distribution_events table.
Real QR scan using device camera.
qr_completions row written on every successful distribution.
aid_requests.status updated to distributed on completion.
Duplicate scan detected and blocked.

---

## Feature 7 — Analytics Page

Replace all hardcoded numbers in /admin/analytics with real computed data.

### Queries needed

Daily submissions last 7 days: group aid_requests by date_trunc('day', created_at) for last 7 days.
Needs breakdown: sum each needs_* boolean column across all aid_requests.
Regional breakdown: group by origin_region count.
Vulnerability counts: count where has_disabled true, infants_count > 0, has_chronic_ill true, has_elderly true.
Trust score distribution: bucket trust_score into ranges (0–19, 20–39, 40–59, 60–79, 80–100) and count.
Urgency score distribution: same approach.
Distribution progress: count approved vs distributed status.
Most common fraud flags: group fraud_events by flag_code, count, order desc.

### Acceptance criteria

All seven charts and number displays on the analytics page read from real database queries.
A date range filter at the top narrows all queries to the selected window.

---

## Feature 8 — Admin Users Page

Wire /admin/users to real data.

### What needs to work

Read all users from user_roles joined with auth.users (use the admin API or a secure RPC).
Display name, email, role, is_active, created_at.
Create user form: calls supabase.auth.admin.createUser (requires service role — must use edge function).
Deactivate: sets is_active false in user_roles, calls supabase.auth.admin.updateUserById to set banned true.

### Notes

Creating and banning users requires the service role key which must never be in the browser.
Create a Supabase Edge Function named admin-user-management that accepts the operation and parameters.
The browser calls this edge function with the admin JWT. The edge function uses the service role key.

---

## Feature 9 — Donation Backend

Wire the donate page to real data.

### What needs to work

A donor fills in their name, donation method, and amount and submits.
Insert into donations table with: donor_name, amount, currency, method, message, created_at.
If they upload a payment proof (screenshot or receipt): upload to a payment-proofs Supabase Storage bucket and insert into payment_proofs with the file reference and donation_id.
The public ledger section reads from a public_ledger RPC or direct select from donations where is_verified is true.
The impact counters (families helped, total raised) read from real aggregates.

### Acceptance criteria

Donation form submits real data.
Payment proof upload works.
Ledger table shows real verified donations.
Counters are computed not hardcoded.

---

## Feature 10 — Device Fingerprint and IP Collection

On form submit in the public form, collect two additional values and include them in the aid_requests insert:
- device_fingerprint: a hash of navigator.userAgent + screen.width + screen.height + navigator.language + Intl.DateTimeFormat().resolvedOptions().timeZone
- ip_hash: not available client-side directly — leave as null for now or use a free IP lookup API if available

### Acceptance criteria

device_fingerprint is calculated and sent to the database on every form submission.
The server-side calculate_scores function already reads this column — once populated it will fire the DEVICE_REUSED signal correctly.

---

## Feature 11 — Timeline Timestamps on Track Page

The track page synthesizes stage timestamps from fixed hour offsets instead of reading real per-stage timestamps.

### Fix

The aid_request_history table exists and is written by the log_request_status_change DB trigger on every status change.
Replace the synthesized offsets with a real query to aid_request_history where request_id matches.
Map each history row's status and changed_at to the correct timeline stage.
Stages without a history row remain as upcoming (no timestamp).

---

## Feature 12 — Structured Reference Storage

Currently reference fields are flattened into the free-text notes column and no references table is written.

### Fix

The submission_references table exists in the database.
After inserting the main aid_requests row, insert a row into submission_references using the reference fields collected in the form (refType, refName, refPhone, refRegion, refVillage, refKnown, refNotes).
Link by request_id.
Check if refPhone exists in mukhtar_whitelist — if found, set is_whitelisted true and whitelist_id.
The submission detail page should read from submission_references not from the notes column.

---

## Implementation Priority Order

Do these in this sequence. Each depends on the previous.

1. Admin authentication (Feature 1) — everything else in admin requires a real user session
2. Audit log writes (Feature 4) — add to every existing admin action immediately after auth works
3. Structured reference storage (Feature 12) — fix the form submission to store references correctly
4. Device fingerprint collection (Feature 10) — small change to form submit, improves scoring immediately
5. Timeline timestamps (Feature 11) — small fix to track page
6. Admin actions on submission detail (Feature 3a through 3e) — tags, assign, contact reference, verify document, resolve fraud
7. Mukhtar whitelist page (Feature 5) — depends on references being stored correctly
8. Distribution management + QR scanner (Feature 6) — largest single feature
9. Analytics page (Feature 7) — queries only, no new UI
10. OTP verification (Feature 2) — requires edge function and Twilio setup
11. Admin users page (Feature 8) — requires edge function for service role operations
12. Donation backend (Feature 9) — standalone, no dependencies

---

## v1 completion status

**All Features 1–12 above are implemented** as of 2026-06-06. For a live inventory of routes, RPCs, and remaining gaps, see [current situation.md](./current%20situation.md).

---

## PRD v2 (follow-on phase)

v2 adds urgency scoring transparency, FIFO queue numbers, server-side admin list/export, saved views, inline edit, and observability. **Core v2 is shipped.**

| Doc | Purpose |
|-----|---------|
| [prd-v2-scoring-queue-ops.md](./prd-v2-scoring-queue-ops.md) | Full v2 spec + implementation status table |
| [current situation.md](./current%20situation.md) | Done vs not done, migrations, ship checklist |
| [role.md](./role.md) | AI/engineering conventions for ongoing work |

**v2 still open (high level):** per-signal scoring weights (A2 remainder), export on queue page, keyset pagination, nightly integrity cron.

*Updated 2026-06-06*