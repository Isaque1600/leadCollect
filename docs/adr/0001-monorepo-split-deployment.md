# Monorepo with split deployment

The codebase is one pnpm workspace monorepo: `apps/api` (NestJS), `apps/web`
(React + Vite SPA), and `packages/types` for shared TypeScript types (Lead shape,
Job status). Deployment is split across free tiers: the SPA to Vercel, the API to
Render, the database to Neon (Postgres).

We chose this over a single container serving both because the free hosting we
already use is provider-specific (Vercel for static frontends, Render for Node
services), and the shared-types package removes the main downside of splitting —
frontend/backend contract drift. The cost is cross-origin setup (CORS locked to
the Vercel domain, JWT bearer auth instead of cookies) and two deploy targets.
