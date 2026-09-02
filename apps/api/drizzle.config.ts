import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` / `migrate` talk to Neon over the **direct**
 * connection string (`DATABASE_URL_DIRECT`), never the pooled one — see
 * ADR-0006. The running app uses the pooled `DATABASE_URL` (see db.module.ts).
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? "",
  },
});
