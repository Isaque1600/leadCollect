import { Global, Module } from "@nestjs/common";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Injection token for the Drizzle database handle. */
export const DB = Symbol("DB");

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Connects Drizzle to Neon over the **pooled** connection string
 * (`DATABASE_URL`, see ADR-0006). `drizzle-kit` migrations use the direct URL
 * instead — see `drizzle.config.ts` and `src/db/migrate.ts`.
 *
 * `postgres()` connects lazily, so importing this module without a reachable
 * database is fine (build, unit tests); the first query is what needs Neon.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Database => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error(
            "DATABASE_URL is not set — the API needs Neon's pooled connection string.",
          );
        }
        const client = postgres(url, { prepare: false });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
