# SANAD — Mobile Responsive Plan & Audit

> **Goal:** Every section and div across all public routes must be usable from **320px** (iPhone SE) through **2560px+** desktops, in **RTL Arabic**.  
> **Agent entry:** [`agent-onboarding.md`](./agent-onboarding.md) §8 summarizes what shipped.

**Last updated:** 2026-06-09 (public pages pass)

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
| Safe areas | `styles.css`, `PublicNav`, `AdminShell`, `auth` | `env(safe-area-inset-*)` + `.safe-top` |
| Nav clearance | `styles.css` | `.public-nav-offset` under fixed header |
| Touch targets | `styles.css` | `.touch-target` min 44px |
| Touch scroll tables | `styles.css` | `.table-scroll` utility (desktop ledger only) |
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

### `/donate` — Donation Page (2026-06-09)

| Section | Mobile fixes |
|---------|--------------|
| Hero | ✅ Shorter `72vh` on mobile, centered logo, full-width CTAs |
| Promise (3 cards) | ✅ Stack → `sm:3-col` |
| DonationJourney | ✅ Carousel dots — **RTL-safe** active index + clay glow on swipe |
| ~~Allocate amount picker~~ | **Removed** — amount in registration form only |
| ~~Families cards~~ | **Removed** |
| Whish / Methods | ✅ Whish card first on mobile; tel/WhatsApp stack full-width |
| Ledger | ✅ **Card layout** `md:hidden`; table only on `md+` (no horizontal scroll) |
| Registration form | ✅ `min-h-11` inputs, styled file upload |
| Pledge wall | ✅ Masonry `columns-1 sm:2 lg:3` |
| FAQ | ✅ Accordion full-width, `min-h-11` tap rows |

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

## Files Changed (2026-06-09 public pass)

```
src/styles.css                    — public-nav-offset, touch-target, safe-area bottom
src/components/PublicNav.tsx      — safe-top, 44px menu button, mobile sheet padding
src/components/PublicFooter.tsx   — 2-col tablet, logo image, break-all contacts
src/components/DonationJourney.tsx — RTL carousel dots, sticky pills safe-top
src/components/DonationSubmitForm.tsx — amount field, touch inputs
src/components/PublicQrCard.tsx   — larger download button
src/routes/index.tsx              — hero logo, field/toggle/chip mobile, no cap UI
src/routes/donate.tsx             — hero, methods layout, ledger cards, FAQ
src/routes/track.tsx              — public-nav-offset, stacked search row
```

Earlier (June 6): admin tables, `AdminShell`, `admin.requests.*`, etc. — still valid.

---

## Future Enhancements (optional)

1. **Admin mobile card views** — Card-per-row on `<md` for admin donations/requests tables
2. **Playwright visual regression** — Snapshot at 375px and 1280px per route
3. **PWA** — manifest + service worker for offline track page

---

*See [`agent-onboarding.md`](./agent-onboarding.md) for full feature context.*
