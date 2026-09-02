# 13: Deploy the SPA to Vercel + wire it end to end

**What to build:** The SPA runs on Vercel and shows "API: ok" against the live
Render API — the walking skeleton is live end to end.

**Blocked by:** 12

**Status:** ready-for-human

- [ ] Import the repo in Vercel with **Root Directory = `apps/web`**
- [ ] Vercel picks up `apps/web/vercel.json` (Vite framework, pnpm workspace install, SPA rewrite)
- [ ] Set `VITE_API_URL` env var to the Render API URL from ticket 12
- [ ] Deploy succeeds; note the Vercel URL (e.g. `https://olc.vercel.app`)
- [ ] Back in Render, set `CORS_ORIGINS` to that Vercel URL (comma-separate to also keep `http://localhost:5173`) and redeploy
- [ ] Open the Vercel URL — it shows **API: ok**
- [ ] Close out ticket 01's last two acceptance boxes

## Notes

- If Vercel's install fails on the workspace, set the install command override to `pnpm install --frozen-lockfile` at the repo root (Vercel usually detects this automatically).
