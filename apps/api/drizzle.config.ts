import { defineConfig } from "drizzle-kit";

/**
 * Schemas are module-owned (ADR-0008): `drizzle-kit` finds every
 * `<module>/infra/*.schema.ts` by glob, so adding a module needs no change
 * here. The runtime connection object is assembled in `src/schema.ts`.
 *
 * `drizzle-kit generate` / `migrate` talk to Neon over the **direct**
 * connection string (`DATABASE_URL_DIRECT`), never the pooled one — see
 * ADR-0006. The running app uses the pooled `DATABASE_URL`
 * (see `src/shared/db/db.module.ts`).
 */
export default defineConfig({
  schema: "./src/modules/**/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? "",
  },
});
