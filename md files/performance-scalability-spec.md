# Performance & Scalability Spec — SANAD Aid Connect

**Status:** Implemented (Phase 1) · **Scope:** Public submit latency + admin load under concurrent applicants

---

## Goals

| Area | Target |
|------|--------|
| **Submit** | User sees success within ~1–2s after clicking send (excluding slow networks) |
| **Admin** | Dashboard and lists stay responsive with multiple staff tabs open during submission spikes |
| **Scale** | Safe at **50 submissions/day** cap + normal staff usage; resist abuse without crashing Supabase |

---

## Architecture (current)

```
Applicant form
  → submission-status (cap gate)
  → precheck-aid-submission (debounced, rate-limited)
  → submit-aid-request (rate-limited, fast INSERT, deferred scoring)
  → background: reference insert + ID upload (non-blocking UI)

Admin
  → /admin/           get_admin_overview_stats RPC (aggregates in SQL)
  → /admin/requests   list_submissions RPC (paginated 25–100)
  → /admin/queue      list_submissions (limit 100)
  → Realtime          throttled refetch (5s), skip when tab hidden
```

---

## Submit path — files & rules

| File | Responsibility | Performance rule |
|------|----------------|------------------|
| `src/routes/index.tsx` | Form UX | Show success **immediately** after submit OK; reference + doc upload run in background |
| `src/lib/precheck-aid-submission.ts` | Client invoke | Debounced 400–600ms in form; fail-open on error |
| `supabase/functions/precheck-aid-submission/index.ts` | Duplicate precheck | Rate limit: 120/hr IP, 60/hr phone (`aid_precheck`) |
| `supabase/functions/submit-aid-request/index.ts` | Insert | Rate limit: 20/hr IP, 5/hr phone (`aid_submit`); **deferred** `calculate_scores` after response |
| `supabase/migrations/20260608120000_performance_admin_overview_deferred_scoring.sql` | DB trigger | INSERT skips synchronous scoring (defaults 50/50 until edge recalc) |

**Do not** remove eligibility check at submit — precheck is UX only.

**Daily cap (50/day)** remains the hard backstop via trigger + unique indexes.

---

## Admin path — files & rules

| File | Responsibility | Performance rule |
|------|----------------|------------------|
| `src/lib/admin-overview.ts` | Overview data | Single RPC — never `select * limit 500` in browser |
| `src/routes/admin.index.tsx` | Dashboard UI | Uses `fetchAdminOverviewStats()` |
| `src/lib/submissions-list.ts` | Requests list | Page size ≤ 100; keyset cursor for load-more |
| `src/routes/admin.requests.tsx` | List UI | Throttled realtime via `useAdminTableRealtime` |
| `src/routes/admin.queue.tsx` | Queue UI | Same throttle; max 100 rows |
| `src/routes/admin.requests.$id.tsx` | Detail UI | Throttled multi-table realtime |
| `src/lib/use-admin-realtime.ts` | Shared hook | 5s throttle; skip refetch if `document.hidden` |
| `src/lib/throttled-callback.ts` | Utility | Trailing throttle for refetch coalescing |
| `src/lib/analytics.ts` | Analytics page | Hard cap **10,000 rows** per query (Phase 2: SQL aggregates RPC) |

**Migration required:** Apply `20260608120000_performance_admin_overview_deferred_scoring.sql` in Supabase Dashboard.

**Redeploy edge functions:** `submit-aid-request`, `precheck-aid-submission` (rate limits + deferred scoring).

---

## Known limits & Phase 2 backlog

| Risk | Mitigation now | Phase 2 |
|------|----------------|---------|
| `list_submissions` runs COUNT + SELECT | Throttled admin realtime | Optional `_skip_count` flag for refresh |
| ILIKE search slow at 10k+ rows | Pagination limits exposure | Trigram index on name/phone/reference |
| Analytics client aggregation | 10k row cap | `get_analytics_snapshot` RPC |
| `rate_limit_log` growth | Per-action windows | Scheduled cleanup job |
| Distribution page unbounded approved list | Staff-only, low frequency | Paginate or RPC |
| Load testing | `npm run smoke:phase6` (functional) | k6 scripts for concurrent submit + admin |

---

## Verification

```bash
npm test
npm run build
npm run verify:rollout   # after migration + edge deploy
npm run smoke:phase6     # functional smoke
```

**Manual checks after deploy:**

1. Submit form — success screen appears before ID upload finishes  
2. Admin overview — loads without fetching 500 full rows (Network tab: one RPC)  
3. Open 2 admin tabs, submit 3 test requests — lists refresh within ~5s, not instantly per row  
4. Queue page — still sorted by urgency, max 100 visible  

---

## Rate limit actions (reference)

| Action | IP limit | Phone limit | Window |
|--------|----------|-------------|--------|
| `aid_precheck` | 120 | 60 | 1 hour |
| `aid_submit` | 20 | 5 | 1 hour |
| `track_lookup` | 30 | 10 | 1 hour |
| `donation_submit` | 10 | 5 | 1 hour |
| `id_upload` | 5 | — | 1 hour |

---

## Cursor rule globs (for future edits)

When changing performance-sensitive code, also update this spec if behavior changes:

- `src/routes/admin*.tsx`
- `src/lib/admin-overview.ts`, `use-admin-realtime.ts`, `throttled-callback.ts`
- `supabase/functions/submit-aid-request/**`, `precheck-aid-submission/**`
- `supabase/migrations/*performance*`
