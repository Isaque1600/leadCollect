# 13: Deploy the SPA to Vercel + wire both environments end to end

**What to build:** The SPA runs on Vercel and shows "API: ok" against the live
Render API — in both the dev and prod environments (see ADR-0007). One Vercel
project, production deploys from `main`, preview deploys from `dev`, each
pointed at its own Render API and each allowed by that API's `CORS_ORIGINS`.

**Blocked by:** 12

**Status:** ready-for-human

## Vercel project

- [x] Import the repo in Vercel with **Root Directory = `apps/web`**
- [x] Vercel picks up `apps/web/vercel.json` (Vite framework, pnpm workspace install, SPA rewrite)
- [x] **Production branch = `main`**
- [x] `VITE_API_URL` env var, scoped per environment:
  - Production → the prod Render URL (`leadCollect-Prod`)
  - Preview → the dev Render URL (`leadCollect-Dev`)
- [x] Note the production URL (e.g. `https://olc.vercel.app`) and the pattern of the preview URLs

## Wire CORS (per environment, ADR-0007)

- [x] `leadCollect-Dev` (Render, branch `dev`): `CORS_ORIGINS` = `http://localhost:5173` + the Vercel preview URL(s), redeploy
- [x] `leadCollect-Prod` (Render, branch `main`): `CORS_ORIGINS` = the Vercel production URL, redeploy
- [x] Set `WEB_APP_URL` on each Render service to its matching SPA origin

## Verify

- [-] Open the Vercel **production** URL → shows **API: ok** (against prod Render)
- [x] Open a **preview** deploy (from a PR into `dev`) → shows **API: ok** (against dev Render)
- [x] Close out ticket 01's last two acceptance boxes

## Reconcile render.yaml (ADR-0007)

- [x] The two Render services were created by hand; `render.yaml` now defines both (`leadCollect-Prod` on `main`, `leadCollect-Dev` on `dev`). Either rename the existing services to match, or delete and re-sync the blueprint, so the setup is reproducible from code.

## Notes

- If Vercel's install fails on the workspace, set the install command to `pnpm install --frozen-lockfile` at the repo root (Vercel usually detects this).
- Preview URLs change per deploy; Vercel also gives a stable `…-git-dev-<scope>.vercel.app` alias for the `dev` branch — use that in the dev `CORS_ORIGINS`.
