# Local dev workflow (TanStack Start + Netlify)

**Agent context:** [`agent-onboarding.md`](./agent-onboarding.md)

## Quick start

```bash
npm run dev
```

Open **http://localhost:8080** (see terminal if the port is taken).

Edits under `src/` (components, routes, CSS) hot-reload through Vite. No manual `npm run build` is needed while developing.

## How it works

| Mode | SSR source | Assets | When to use |
|------|------------|--------|-------------|
| **`npm run dev`** | Live `src/` via TanStack Start + Vite | Vite dev server (HMR) | Day-to-day UI and route work |
| **`npm run build`** | Rollup output in `dist/server` | Hashed files in `dist/client` | Production deploy, smoke tests, verifying prod bundle |
| **`npm run preview`** | Built `dist/` | Built `dist/client` | Pre-ship check of production output locally |

The `@netlify/vite-plugin-tanstack-start` plugin still runs in dev for Netlify platform emulation (env vars, redirects, headers, edge functions). **Serverless function SSR is disabled in dev** so requests are handled by TanStack Start’s native Vite SSR instead of stale `dist/server` output.

Production deploy is unchanged: `netlify.toml` runs `npm run build`, publishes `dist/client`, and serves SSR through `.netlify/v1/functions/server.mjs`.

## What to expect

- **First page load** after `npm run dev` may take a few seconds while Vite compiles SSR modules.
- **CSS** from `src/styles.css` and Tailwind applies immediately; no stylesheet 404s from mismatched `dist/` hashes.
- **Hard refresh** shows current source — you do not need to rebuild.
- If the dev server was started before a dependency upgrade, restart it and clear `node_modules/.vite` if SSR throws missing-export errors.

## When to run `npm run build`

- Before deploying (Netlify CI runs this automatically).
- Before `npm run preview` or `npm run smoke:ship`.
- When validating production-only behavior (inline CSS, hashed assets, function bundle size).

You do **not** need `npm run build` for normal local UI development.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Styles or components stuck on old version | Restart `npm run dev`; ensure you are not running `npm run preview` by mistake |
| `createMiddleware is not a function` on first SSR request | Restart dev server; delete `node_modules/.vite` |
| Asset 404s in dev | Do not serve from an old `dist/` — dev should not require a prior build |
| Production 404 / function errors | Run `npm run build` locally and confirm log shows `Wrote SSR entry point to .netlify/v1/functions/server.mjs` |
