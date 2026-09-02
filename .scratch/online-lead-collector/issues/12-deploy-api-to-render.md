# 12: Deploy the API to Render

**What to build:** The API runs on Render, reachable over HTTPS, with
`GET /health` returning `{ "status": "ok" }`.

**Blocked by:** 11

**Status:** ready-for-human

- [x] Render account connected to the GitHub repo
- [x] New **Blueprint** created from `render.yaml` (it defines the `olc-api` web service, free plan)
- [x] `CORS_ORIGINS` env var set — for now `http://localhost:5173`; ticket 13 adds the Vercel URL
- [x] Deploy succeeds; note the service URL (e.g. `https://olc-api.onrender.com`)
- [x] `curl https://<service>.onrender.com/health` returns `{"status":"ok"}`

## Notes

- Free instances sleep after ~15 min idle; the first request after sleep is slow. Fine for now.
- The build command in `render.yaml` runs `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @olc/api build`; the `@olc/api` build script builds `@olc/types` first (fixed in commit 5f4b443).
- Check which branch the Render service tracks (`dev` or `main`) — set it deliberately in the service settings.
