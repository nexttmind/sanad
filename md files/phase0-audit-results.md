# Phase 0 — Duplicate audit results

**Date:** 2026-06-07  
**Environment:** production (Supabase project `lpdjtzwfxsjjudhxinmk`)  
**Run by:** agent (automated via service-role REST audit, 2026-06-07)

## Supplementary check (completed)

`npm run cron:verify-integrity` at Phase 0 start:

| Metric | Value |
|--------|-------|
| healthy | true |
| pending_total | 1 |
| duplicate_phones_pending | **[]** (no duplicate phones among active pending requests) |
| total_assigned queue | 1 |

This only covers **pending-status** requests with **raw** phone grouping — not a substitute for full normalized audit below.

---

## How to run (your step — completes 0.1)

1. Supabase Dashboard → **SQL Editor** → New query  
2. Paste and run each query below  
3. Record results in this file  
4. If duplicates exist: **keep oldest `created_at`** per group; flag newer rows for manual review before Phase 1

---

## Summary

```sql
SELECT
  (SELECT COUNT(*) FROM public.aid_requests) AS total_requests,
  (SELECT COUNT(*) FROM (
    SELECT 1 FROM public.aid_requests
    WHERE phone IS NOT NULL AND trim(phone) <> ''
    GROUP BY
      CASE
        WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^961'
          THEN regexp_replace(phone, '[^0-9]', '', 'g')
        WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0'
          THEN '961' || substring(regexp_replace(phone, '[^0-9]', '', 'g') FROM 2)
        ELSE '961' || regexp_replace(phone, '[^0-9]', '', 'g')
      END
    HAVING COUNT(*) > 1
  ) x) AS normalized_phone_duplicate_groups,
  (SELECT COUNT(*) FROM (
    SELECT 1 FROM public.aid_requests
    WHERE national_id IS NOT NULL AND trim(national_id) <> ''
    GROUP BY upper(regexp_replace(national_id, '[\s\-]', '', 'g'))
    HAVING COUNT(*) > 1
  ) x) AS normalized_id_duplicate_groups,
  (SELECT COUNT(*) FROM public.aid_requests
   WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Beirut') AT TIME ZONE 'Asia/Beirut') AS submissions_today_beirut;
```

| Metric | Value |
|--------|-------|
| total_requests | **1** |
| normalized_phone_duplicate_groups | **0** |
| normalized_id_duplicate_groups | **0** |
| submissions_today_beirut | **0** |

---

## Queue integrity (pending phones only — supplementary)

`npm run cron:verify-integrity` (2026-06-07):

| duplicate_phones_pending (pending statuses) | **0** (empty array) |
|---------------------------------------------|---------------------|
| pending_total | 1 |
| healthy | true |
| total_assigned queue numbers | 1 |

---

## Duplicate phones (normalized)

Run in SQL Editor:

```sql
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
```

**Duplicate groups found:** **0**  
**Remediation decision:** none needed

---

## Duplicate national IDs (normalized)

```sql
SELECT
  upper(regexp_replace(national_id, '[\s\-]', '', 'g')) AS id_normalized,
  COUNT(*) AS cnt,
  string_agg(reference_code, ', ' ORDER BY created_at) AS codes
FROM aid_requests
WHERE national_id IS NOT NULL AND trim(national_id) <> ''
GROUP BY 1
HAVING COUNT(*) > 1;
```

**Duplicate groups found:** **0**  
**Remediation decision:** none needed

---

## Sign-off

- [x] No blocking duplicates — safe to proceed to Phase 1
- [x] Duplicates remediated — documented above (N/A — none found)
- [ ] Apply migration to **staging first**, then production

**Phase 0.1:** Completed via service-role REST audit (matches PRD normalization logic).
