# 13: Deploy the SPA to Vercel + wire both environments end to end

**What to build:** The SPA runs on Vercel and shows "API: ok" against the live
Render API — in both the dev and prod environments (see ADR-0007). One Vercel
project, production deploys from `main`, preview deploys from `dev`, each
pointed at its own Render API and each allowed by that API's `CORS_ORIGINS`.

**Blocked by:** 12

**Status:** ready-for-human

## Vercel project

- [ ] Import the repo in Vercel with **Root Directory = `apps/web`**
- [ ] Vercel picks up `apps/web/vercel.json` (Vite framework, pnpm workspace install, SPA rewrite)
- [ ] **Production branch = `main`**
- [ ] `VITE_API_URL` env var, scoped per environment:
  - Production → the prod Render URL (`olc-api`)
  - Preview → the dev Render URL (`olc-api-dev`)
- [ ] Note the production URL (e.g. `https://olc.vercel.app`) and the pattern of the preview URLs

## Wire CORS (per environment, ADR-0007)

- [ ] `olc-api-dev` (Render, branch `dev`): `CORS_ORIGINS` = `http://localhost:5173` + the Vercel preview URL(s), redeploy
- [ ] `olc-api` (Render, branch `main`): `CORS_ORIGINS` = the Vercel production URL, redeploy
- [ ] Set `WEB_APP_URL` on each Render service to its matching SPA origin

## Verify

- [ ] Open the Vercel **production** URL → shows **API: ok** (against prod Render)
- [ ] Open a **preview** deploy (from a PR into `dev`) → shows **API: ok** (against dev Render)
- [ ] Close out ticket 01's last two acceptance boxes

## Reconcile render.yaml (ADR-0007)

- [ ] The two Render services were created by hand; `render.yaml` now defines both (`olc-api` on `main`, `olc-api-dev` on `dev`). Either rename the existing services to match, or delete and re-sync the blueprint, so the setup is reproducible from code.

## Notes

- If Vercel's install fails on the workspace, set the install command to `pnpm install --frozen-lockfile` at the repo root (Vercel usually detects this).
- Preview URLs change per deploy; Vercel also gives a stable `…-git-dev-<scope>.vercel.app` alias for the `dev` branch — use that in the dev `CORS_ORIGINS`.
