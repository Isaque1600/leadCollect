# 14: Make CI steps explicit

**What to build:** The single `check` job in `.github/workflows/ci.yml` keeps
running everything in one job (install once, no per-job setup overhead), but the
run is broken into separately named steps — `lint`, `typecheck`, `test`,
`build` — so a red check points straight at what broke. `pnpm -r` already prints
per-package results within each step, so "web test failed" is visible without
splitting into per-service jobs.

Deliberately **not** doing a per-service or per-check job matrix: at this repo
size the checkout + Node + pnpm-install overhead per job dwarfs the few seconds
each check actually takes. Revisit only when a single check exceeds ~2-3 minutes.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `ci.yml` has distinct steps: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, each with a clear `name`
- [ ] `@olc/types` is built before `typecheck` (its consumers need the declaration output)
- [ ] Steps run in one job; a later step failing does not hide an earlier failure (default fail-fast is fine — first failure is the report)
- [ ] pnpm store caching still enabled
- [ ] Triggers unchanged: pull requests, and pushes to `main`
- [ ] Root `pnpm lint` / `typecheck` / `test` / `build` unchanged for local use
