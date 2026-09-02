import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { schema, type Schema } from "../../schema";
import { databaseConfig } from "../config/database.config";

/** Injection token for the Drizzle database handle. */
export const DB = Symbol("DB");

/** Injection token for the underlying postgres.js client, closed on shutdown. */
export const DB_CLIENT = Symbol("DB_CLIENT");

export type Database = PostgresJsDatabase<Schema>;

/**
 * Connects Drizzle to Neon over the **pooled** connection string
 * (`DATABASE_URL`, ADR-0006). `drizzle-kit` migrations use the direct URL
 * instead — see `drizzle.config.ts` and `src/shared/db/migrate.ts`.
 *
 * `postgres()` connects lazily, so importing this module without a reachable
 * database is fine (build, unit tests); the first query is what needs Neon.
 *
 * Lives in `shared/` because every module that stores anything needs the handle;
 * the tables themselves stay module-owned (ADR-0008).
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>): Sql =>
        postgres(config.url, { prepare: false }),
    },
    {
      provide: DB,
      inject: [DB_CLIENT],
      useFactory: (client: Sql): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB_CLIENT) private readonly client: Sql) {}

  /** Nest lifecycle hook — drains the pool so the process can exit cleanly. */
  async onApplicationShutdown(): Promise<void> {
    await this.client.end();
  }
}
