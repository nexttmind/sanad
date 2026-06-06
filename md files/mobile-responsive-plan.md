# SANAD — Mobile Responsive Plan & Audit

> **Goal:** Every section and div across all 17 routes must be usable from **320px** (iPhone SE) through **2560px+** desktops, in **RTL Arabic**.

---

## Breakpoint Strategy

| Token | Width | Usage |
|-------|-------|-------|
| default | 0–639px | Single column, stacked cards, full-width inputs |
| `sm:` | 640px+ | 2-column forms, larger typography |
| `md:` | 768px+ | Public nav desktop menu, admin 2-col filters |
| `lg:` | 1024px+ | Admin sidebar, donate/request multi-column layouts |
| `min-[400px]` / `min-[420px]` | Custom | Hero stat bars, payment method grid |

**Design principle:** Mobile-first — base styles target phones; breakpoints add complexity.

---

## Global Foundations (implemented)

| Item | File | Change |
|------|------|--------|
| Viewport + notch | `__root.tsx` | `viewport-fit=cover` |
| Overflow guard | `styles.css` | `overflow-x: clip` on `html`/`body` |
| Safe areas | `styles.css`, `AdminShell`, `auth` | `env(safe-area-inset-*)` padding |
| Touch scroll tables | `styles.css` | `.table-scroll` utility |
| Stacking detail rows | `styles.css` | `.detail-row` — label above value on <480px |

---

## Page-by-Page Audit

### Public Layout

| Component | Sections | Mobile treatment |
|-----------|----------|------------------|
| **PublicNav** | Logo, hamburger, overlay sheet | ✅ Already mobile-first (`md:hidden` menu, scroll lock) |
| **PublicFooter** | 4-col grid, copyright bar | ✅ Fixed: `px-5` on mobile, stacks to 1 col |

### `/` — Aid Request Form

| Section | ID | Mobile fixes |
|---------|-----|--------------|
| Hero | — | ✅ 2-col stats grid, responsive headline |
| Personal info | `sec-personal` | ✅ 1-col → `md:2-col` grid |
| Family | `sec-family` | ✅ 1-col → `md:3-col` |
| Displacement | `sec-disp` | ✅ Conditional 2-col |
| Needs + chips | `sec-needs` | ✅ Flex-wrap chips, sub-forms stack |
| Reference | `sec-ref` | ✅ 1-col → `md:2-col` |
| Document upload | `sec-doc` | ✅ Full-width file input |
| Review + submit | `sec-review` | ✅ Full-width CTA |
| Success + QR | — | ✅ QR scales `max-w-full`, code stacks vertically |
| PhoneOtpSection | — | ✅ OTP centered, horizontal scroll if needed |

### `/donate` — Donation Page

| Section | Mobile fixes |
|---------|--------------|
| Hero + live ticker | ✅ Stats stack 1-col below 400px, smaller type |
| Promise (3 cards) | ✅ Stack → `sm:3-col` |
| DonationJourney | ✅ Mobile carousel + step pills (existing) |
| Allocate amount picker | ✅ `grid-cols-3` → `sm:grid-cols-5` |
| Families cards | ✅ 1-col → `md:3-col`, header stacks |
| Ledger table | ✅ `.table-scroll` + `min-w-[520px]` |
| Payment methods | ✅ 1-col → `min-[420px]:2-col` |
| Pledge wall | ✅ Masonry `columns-1 sm:2 lg:3` |
| FAQ | ✅ Accordion full-width |

### `/track` — Track Request

| Section | Mobile fixes |
|---------|--------------|
| Search form | ✅ 1-col → `md:2-col` |
| Identity card | ✅ Responsive padding `px-5 sm:px-6` |
| Timeline | ✅ Vertical stack with connector |
| Summary (collapsible) | ✅ `grid-cols-1 sm:2` dl |
| Contact CTAs | ✅ Stack → `sm:2-col` |

### `/auth` — Login

| Section | Mobile fixes |
|---------|--------------|
| Centered card | ✅ `max-w-md`, safe-area bottom padding |

---

### Admin Layout

| Component | Mobile fixes |
|-----------|--------------|
| **AdminShell** | ✅ Drawer `w-72 max-w-[85vw]`, menu btn `lg:hidden`, safe-area main padding |
| Header search | Hidden on mobile (by design — use page-level filters) |

### `/admin` — Overview

| Section | Mobile fixes |
|---------|--------------|
| Stat cards (8) | ✅ `grid-cols-2`, smaller padding/text on mobile |
| Priority alerts | ✅ `flex-wrap` pills |
| Queue priority list | ✅ Card layout, tier badge hidden on xs |
| Recent requests | ✅ **Rebuilt** — card rows instead of `grid-cols-12` |
| Vulnerable summary | ✅ Full-width bars |
| Daily chart | ✅ Flex bars scale |

### `/admin/queue` — Work Queue

| Section | Mobile fixes |
|---------|--------------|
| Bulk assign form | ✅ Full-width select on mobile |
| Queue table | ✅ `.table-scroll` horizontal |

### `/admin/requests` — Requests List

| Section | Mobile fixes |
|---------|--------------|
| Filter panel | ✅ Stacks 1-col, reset btn full-width on mobile |
| Sort chips | ✅ `flex-wrap` |
| Data table | ✅ `.table-scroll` + `min-w-[720px]` |

### `/admin/requests/$id` — Request Detail

| Section | Mobile fixes |
|---------|--------------|
| Status actions | ✅ `flex-wrap` |
| Header card | ✅ `text-2xl sm:text-3xl`, reduced padding |
| Editable sections | ✅ `.detail-row` stacks labels |
| Sidebar cards | ✅ Single column below `lg` |

### `/admin/donations`, `/references`, `/users`, `/audit`

| Section | Mobile fixes |
|---------|--------------|
| Search/filter bars | ✅ Full-width inputs on mobile |
| Tables | ✅ `.table-scroll` on all |

### `/admin/distribution`, `/analytics`, `/scoring`

| Section | Mobile fixes |
|---------|--------------|
| Session cards | ✅ `md:grid-cols-3`, stats grid OK at 320px |
| Charts | ✅ Single column below `lg` |

---

## Testing Matrix

Test every page at these widths in Chrome DevTools (RTL):

| Width | Device class |
|-------|--------------|
| 320px | iPhone SE |
| 375px | iPhone 12/13 |
| 390px | iPhone 14 Pro |
| 414px | iPhone Plus |
| 768px | iPad portrait |
| 1024px | iPad landscape / small laptop |
| 1280px | Desktop |
| 1920px | Full HD |

**Checklist per page:**
- [ ] No horizontal page scroll (only intentional table scroll)
- [ ] All text readable without zoom
- [ ] Tap targets ≥ 44×44px on buttons/links
- [ ] Forms usable with on-screen keyboard
- [ ] Modals/sheets fit viewport height
- [ ] Images/QR codes scale within container

---

## Files Changed (this implementation)

```
src/styles.css                          — global mobile utilities
src/routes/__root.tsx                   — viewport meta
src/components/PublicFooter.tsx         — padding
src/components/AdminShell.tsx           — safe-area main
src/components/PhoneOtpSection.tsx      — OTP centering
src/components/admin/EditableRequestSections.tsx — detail-row
src/components/admin/QueueIntegrityPanel.tsx     — table-scroll
src/routes/index.tsx                    — success QR
src/routes/donate.tsx                   — hero, allocate, ledger, families
src/routes/auth.tsx                     — safe-area
src/routes/admin.index.tsx              — stats + list cards
src/routes/admin.requests.tsx           — filters + table
src/routes/admin.requests.$id.tsx       — detail rows + cards
src/routes/admin.queue.tsx              — bulk assign + table
src/routes/admin.donations.tsx          — search + table
src/routes/admin.references.tsx         — table
src/routes/admin.users.tsx              — table
src/routes/admin.audit.tsx              — table
```

---

## Future Enhancements (optional)

1. **Admin mobile card views** — Replace horizontal table scroll with card-per-row on `<md` for donations/requests
2. **Mobile admin search** — Collapsible search icon in AdminShell header
3. **Playwright visual regression** — Snapshot tests at 375px and 1280px per route
4. **PWA** — Add manifest + service worker for offline track page

---

*Last updated: June 6, 2026*
