# 01: Walking skeleton

**What to build:** A deployed end-to-end pipe with no domain logic yet. A pnpm
workspace monorepo with `apps/api` (NestJS), `apps/web` (React + Vite SPA), and
`packages/types` (shared TypeScript types, empty for now). The API exposes a
`GET /health` endpoint; the SPA calls it on load and shows the result. CI runs on
pull requests. The API is deployed to Render and the SPA to Vercel, both from the
monorepo, and the deployed SPA successfully reaches the deployed API's `/health`.

**Blocked by:** None (can start immediately).

**Status:** in-progress (code done; deployment steps need the user)

- [x] `pnpm-workspace.yaml` with `apps/*` and `packages/*`; root scripts for lint, typecheck, test
- [x] `apps/api` is a running NestJS app with `GET /health` returning `{ status: "ok" }` (verified locally)
- [x] `apps/web` is a Vite React SPA that fetches `/health` and renders "API: ok" (App.tsx, covered by App.test.tsx)
- [x] `packages/types` (`@olc/types`) exports `HealthResponse`, imported by both apps
- [x] CORS on the API driven by `CORS_ORIGINS` (defaults to `http://localhost:5173`); Vercel origin added via env
- [x] `.github/workflows/ci.yml` runs `pnpm lint` + `pnpm typecheck` + `pnpm test` on PRs and pushes to main
- [ ] API deployed to Render (`render.yaml` blueprint ready), SPA deployed to Vercel (`apps/web/vercel.json` ready), `VITE_API_URL` + `CORS_ORIGINS` set — **needs the user's Render/Vercel/GitHub accounts**
- [ ] The live SPA shows "API: ok" against the live API — follows from the deploy step

## Notes

- Legacy Python moved to `legacy/` per ADR-0004.
- Local verify: `pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test` all green; `node apps/api/dist/main.js` serves `GET /health` → `{"status":"ok"}` with the CORS header.
- Deploy: push to a GitHub repo, point Render at `render.yaml` (set `CORS_ORIGINS` to the Vercel URL), import the repo in Vercel with root `apps/web` (set `VITE_API_URL` to the Render URL).
