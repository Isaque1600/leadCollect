import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies the generated SQL migrations in `drizzle/` against Neon's **direct**
 * connection (`DATABASE_URL_DIRECT`, see ADR-0006). Run with:
 *   pnpm --filter @olc/api db:migrate
 */
async function main() {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) {
    throw new Error(
      "DATABASE_URL_DIRECT is not set — drizzle-kit migrations need Neon's direct (non-pooled) connection string.",
    );
  }

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    console.log("migrations applied");
  } finally {
    await client.end();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
