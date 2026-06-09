# What We Have Achieved — Plain English Summary

**Project:** SANAD Aid Connect  
**Updated:** 2026-06-09  
**Production database:** Live on Supabase (`lpdjtzwfxsjjudhxinmk`)  
**Production site:** https://sanadd.co  
**For engineers/agents:** Start with [`agent-onboarding.md`](./agent-onboarding.md) — this doc is stakeholder-friendly.

This document explains, in simple language, what the platform can do today. Each section includes a real-world example.

---

## For families applying for aid

### Submit an aid request (no SMS OTP)

A family fills out the form on the homepage. The system checks that their phone and ID document number have not been used before, then saves the request. Staff verify by phone call later — not by SMS code.

**Example:** Fatima enters her details and uploads her ID. The form stays open even on busy days (no daily “we are full” block). Her request is saved with reference code `SND-XXXXX`.

### Upload an ID document safely

Applicants can attach a photo or PDF of their ID as part of the application. Uploads go through a controlled server path — not wide-open public storage.

**Example:** Fatima uploads `id.jpg` (under 5 MB). The system stores it under her request folder. Random people cannot upload files to random paths in the bucket.

### Track their request online

On the **Track** page (`/track`), a family enters their reference code and phone number to see status and history.

**Example:** Fatima enters `SANAD-A7K2` and her phone. She sees: *Under review* and a timeline of status changes.

### See their place in the queue (when waiting)

If the request is still in a pending stage, the track page can show queue position — but **only** when the person proves they own the request (code + phone). Strangers cannot look up someone else’s position.

**Example:** Fatima sees: *You are #47 of 312 pending requests.*

---

## For donors

### Donate via Whish or contact the team

The donate page explains how to transfer via **Whish Money** (`+961 81 432 343`) with one-tap call or WhatsApp. For bank, PayPal, or other channels, donors contact `+961 3 689 363`.

**Example:** A donor opens `/donate`, copies the Whish number, sends $50 via Whish, then fills the registration form with amount and optional payment screenshot.

### No “pick a family” list on the public page

We removed the public list of adoptable cases — donations go to the general fund unless staff assign them later.

### Donation spam protection

Pledge submissions are rate-limited so one person cannot flood the system with fake donations.

**Example:** After 10 pledge attempts from the same connection in one hour, the next attempt gets a friendly “try again later” message.

---

## For staff and admins

### Fair ordering with queue numbers

Every aid request gets a permanent queue number when it enters the system. Staff work through requests in order.

**Example:** Request A gets queue #45, Request B gets #46. Even if B’s urgency score is higher, the queue number stays fixed for audit and fairness.

### Admin work queue

Staff use **Admin → Queue** to see pending requests in FIFO order, assign work, and run integrity checks.

**Example:** A reviewer opens the queue, selects the top 10 unassigned requests, and assigns them to themselves.

### Daily intake batches (50 per Beirut day)

On **Admin → Requests**, staff can turn on «دفعة اليوم» to review today’s submissions in batches of 50, ordered by queue number — while the public form stays open all day.

**Example:** On a busy Tuesday, 120 requests arrived. Batch 1 shows #1–50, Batch 2 shows #51–100, Batch 3 shows #101–120.

### Scoring and urgency

The system calculates urgency from many signals (housing, family size, infants, fraud flags, etc.). Admins can preview scores, adjust config, and override when needed.

**Example:** A request scores 72/100 urgency. An admin adds a priority flag for a medical emergency and the effective score updates.

### Search, filter, and export large lists

Admins can filter thousands of requests (by governorate, tags, assignee, score range, needs, etc.) and export to CSV — including large exports that run in the background.

**Example:** An admin filters *Beirut + status reviewing + queue 1–500*, exports 6,000 rows. The export runs in batches and downloads when complete. Extra columns (tags, needs, children count, etc.) can be included.

### Request detail page stays up to date

When another staff member changes a request, notes, or files, the detail page refreshes automatically without a manual reload.

**Example:** Reviewer A is reading a case. Reviewer B adds a note — Reviewer A sees it appear within seconds.

### Distribution with QR and PIN

At a distribution event, staff scan a QR code and enter a PIN to mark aid as delivered.

**Example:** Staff scan the family’s QR, enter PIN `4821`. If they type the wrong PIN five times in 15 minutes, the system locks further attempts for that request.

### User and role management

Admins create staff accounts, assign roles (admin, reviewer, distributor), and deactivate users through a secure server function.

**Example:** The project lead creates a new reviewer account and assigns the *reviewer* role without sharing the database password.

### Audit trail

Important actions (exports, role changes, integrity failures) are logged for accountability.

**Example:** After a bulk CSV export, a row appears in **Admin → Audit** showing who ran it and when.

---

## Security improvements (invisible to most users, critical for launch)

### Rate limits on sensitive actions

We added shared rate limiting for OTP, tracking, donations, and file uploads.

| Action | Limit (example) | What it stops |
|--------|-----------------|---------------|
| OTP send | Per phone / per IP | SMS bombing |
| Track lookup | 30/hour per IP, 10/hour per phone | Guessing codes at scale |
| Donation pledge | 10/hour per IP | Fake pledge spam |
| ID upload | 5/hour per IP | Storage abuse |

**Example:** Someone tries to track 50 different codes in an hour from the same café Wi‑Fi. After 30 tries, they get blocked until the hour resets.

### IP fingerprint for fraud scoring (hashed, not raw)

When someone submits an aid request, the server records a **hashed** fingerprint of their connection — not their raw IP address. This helps detect clusters of suspicious submissions.

**Example:** Four applications from the same network in one hour each get a small fraud penalty in scoring. Staff still see the requests; the system flags the pattern.

### Database access locked down

- Public users cannot directly insert aid requests, donations, or files anymore — they go through edge functions that validate first.
- Queue position is staff-only at the database level; applicants get position only through the track flow.
- Donation proof photos are read-only for the public; only admins can change them.
- CORS on edge functions uses an allowlist (your website + localhost for dev), not “any website on the internet.”

**Example:** A malicious script on `evil-site.com` cannot call your Supabase functions from a victim’s browser — the browser blocks it because that origin is not on the allowlist.

### PIN brute-force protection

Distribution PINs are checked on the server with attempt logging and lockout — not compared only in the browser.

**Example:** After five wrong PINs for the same request, staff see a lockout message and must wait before trying again.

---

## Reliability and performance

### Faster public pages

Homepage and donate page stats are cached briefly in the browser so repeat visits do not hammer the database.

**Example:** A visitor opens the homepage, navigates to donate and back — stats load from cache for about one minute instead of three separate database calls.

### Safer large exports

Very large CSV exports use keyset pagination (cursor-based batches) instead of skipping rows by offset, so exports stay accurate even as the queue changes.

**Example:** An export of 20,000 rows does not skip or duplicate rows when new requests are added mid-export.

### Nightly queue health check (automated)

Every night at 3:00 AM UTC, the system automatically checks:

- Are queue numbers unique?
- Is the numbering sequence in sync?
- Are there duplicate pending phones?

If something is wrong, it logs an alert and writes to the audit log.

**Example:** You ran `npm run cron:verify-integrity` and saw `"healthy": true` — the same check runs automatically every night. If queue numbers ever duplicate, you would see an entry in audit logs the next morning.

---

## Mobile-friendly public site (2026-06-09)

- Larger tap targets on buttons, checkboxes, and carousel dots
- Donation journey photo swipes update glowing indicator dots (RTL-safe)
- Public ledger shows as cards on phones (no sideways table scroll)
- Safe-area padding for notched phones
- Centered SANAD logo in hero on home and donate pages

## Social & contact

- Footer links to Instagram: [@hsaleh94](https://www.instagram.com/hsaleh94/?hl=en)
- Editable in **Admin → Public settings → Contact**

## What is live in production (operator checklist)

| Item | Status |
|------|--------|
| Frontend on Netlify (`sanadd.co`) | Done |
| June 9 migrations on Supabase | **Apply** `091000`–`091600` if not yet run |
| Edge functions redeployed after CORS/limit changes | **Verify** operator |
| CSP enforced (not report-only) | Done in `netlify.toml` |
| 209 automated tests | Passing |
| Production smoke test (`npm run smoke:ship`) | Run after deploy |

---

## What is still optional or not done

These are not blockers for launch but remain on the backlog:

| Item | Notes |
|------|-------|
| Monitoring checklist document | Operator runbook for weekly reviews |
| CDN cache headers | Depends on hosting platform (Vercel, Netlify, etc.) |
| First-admin race fix | Low priority — only matters on very first staff signup |
| Rotate exposed secrets | Recommended if any secret was shared in chat or logs |
| Frontend deploy to production URL | Client code must match the new edge function flows |
| Twilio live SMS | Needed for real OTP texts in production (not dev log mode) |
| `ALLOWED_ORIGINS` with live domain | Add your real website URL to edge secrets |

---

## Quick “before go-live” test list

1. Submit a test aid request end-to-end (form → precheck → ID upload → submit).
2. Track it on `/track` with code + phone.
3. On `/donate` — copy Whish number, swipe journey photos (dots should move), submit pledge form.
4. Log in as staff — check **دفعة اليوم** on requests list, one detail page, scoring preview.
5. Confirm footer Instagram link opens correctly.

---

*Technical reference: [`agent-onboarding.md`](./agent-onboarding.md) · History: [`updates.md`](./updates.md)*
