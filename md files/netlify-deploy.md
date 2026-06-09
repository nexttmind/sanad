# Deploy SANAD on Netlify

**Production:** https://sanadd.co · **Agent context:** [`agent-onboarding.md`](./agent-onboarding.md)

This project uses **TanStack Start** (server-side rendering). Netlify runs the app as a serverless function plus static assets.

**CSP:** Enforced in `netlify.toml` (security phase C, 2026-06-09).

---

## What was added to the repo

| File | Purpose |
|------|---------|
| `netlify.toml` | Build command, publish folder, Node version, cache headers |
| `@netlify/vite-plugin-tanstack-start` | Wires SSR build for Netlify (creates `.netlify/v1/functions/server.mjs`) |
| `.env.example` | Template for environment variables |

---

## Local development

See [dev-workflow.md](./dev-workflow.md) for `npm run dev` (live SSR/HMR) vs production build.

---

## One-time Netlify setup

### 1. Push code to GitHub

Netlify deploys from Git. Push this repo to GitHub (or GitLab/Bitbucket).

### 2. Create a new site on Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect your Git provider and select this repository
3. Netlify should auto-detect settings from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist/client`
   - **Functions directory:** `.netlify/v1/functions`
   - **Node version:** 22

If anything is blank, enter those values manually under **Site configuration → Build & deploy → Build settings**.

### 3. Add environment variables

**Site configuration → Environment variables → Add a variable**

Add these for **Production** (and **Deploy previews** if you want previews to work):

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://lpdjtzwfxsjjudhxinmk.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |
| `VITE_SUPABASE_PROJECT_ID` | `lpdjtzwfxsjjudhxinmk` |

Optional (same values — helps SSR/scripts):

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | Same as `VITE_SUPABASE_PUBLISHABLE_KEY` |

Do **not** add service role keys or `SCHEDULED_FUNCTION_SECRET` to Netlify — those stay in Supabase only.

### 4. Deploy

Click **Deploy site** (or push to `main` to trigger a build).

When the build finishes, Netlify gives you a URL like:

`https://your-site-name.netlify.app`

### 5. Update Supabase CORS (required)

After you know your Netlify URL, add it to Supabase:

**Edge Functions → Secrets → `ALLOWED_ORIGINS`**

Example (SANAD production):

```
https://sanadd.co,https://www.sanadd.co,http://localhost:5173,http://localhost:8080
```

Include Netlify preview URLs via the built-in `*--sanaddd.netlify.app` regex in edge functions, or add branch deploy origins to `ALLOWED_ORIGINS` if needed.

---

## Deploy from your computer (optional)

Requires [Netlify CLI](https://docs.netlify.com/cli/get-started/) **17.31+**:

```bash
npm install -g netlify-cli
netlify login
netlify init
npm run build
netlify deploy --prod
```

---

## Verify after deploy

1. Homepage loads and shows live stats
2. `/track`, `/donate`, and `/auth` open without errors
3. Submit a test aid request (OTP + form)
4. Staff login at `/auth` → admin pages work

Run from your machine (optional):

```bash
npm run smoke:ship
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Netlify | Confirm Node 22 in build settings; check build log for missing env vars |
| Blank page / Supabase error | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Netlify env |
| Edge function CORS errors in browser | Add your Netlify URL to `ALLOWED_ORIGINS` in Supabase |
| 404 on refresh for `/admin/...` | Should not happen with TanStack Start SSR — if it does, confirm `@netlify/vite-plugin-tanstack-start` is in `vite.config.ts` and rebuild |
| Functions not found | Ensure `functions = ".netlify/v1/functions"` in `netlify.toml` and build log shows `Netlify ✓ Wrote SSR entry point` |

---

## Custom domain (optional)

**Site configuration → Domain management → Add a domain**

Then add that domain to Supabase `ALLOWED_ORIGINS`.
