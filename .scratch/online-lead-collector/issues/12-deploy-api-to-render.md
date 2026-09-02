# 12: Deploy the API to Render

**What to build:** The API runs on Render, reachable over HTTPS, with
`GET /health` returning `{ "status": "ok" }`.

**Blocked by:** 11

**Status:** ready-for-human

- [ ] Render account connected to the GitHub repo
- [ ] New **Blueprint** created from `render.yaml` (it defines the `olc-api` web service, free plan)
- [ ] `CORS_ORIGINS` env var set — for now `http://localhost:5173`; ticket 13 adds the Vercel URL
- [ ] Deploy succeeds; note the service URL (e.g. `https://olc-api.onrender.com`)
- [ ] `curl https://<service>.onrender.com/health` returns `{"status":"ok"}`

## Notes

- Free instances sleep after ~15 min idle; the first request after sleep is slow. Fine for now.
- The build command in `render.yaml` runs `corepack enable` then installs and builds `@olc/types` + `@olc/api`.
