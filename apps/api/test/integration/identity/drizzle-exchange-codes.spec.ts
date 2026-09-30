import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { schema, type Schema } from "../../../src/schema";
import { users } from "../../../src/modules/identity/infra/identity.schema";
import { DrizzleExchangeCodes } from "../../../src/modules/identity/infra/drizzle-exchange-codes.repository";

/**
 * The exchange code store against a real Postgres: what a fake cannot stand in
 * for is that the table never holds a usable code, and that two redemptions of
 * the same code racing on separate connections cannot both win.
 *
 * Runs under `pnpm --filter @olc/api test:integration` and skips when
 * `DATABASE_URL_TEST` is unset. Point that at a **disposable**, migrated
 * database: the tables below are truncated between tests.
 */
const url = process.env.DATABASE_URL_TEST;

const CODE = "Xk3p9Qm2Lr7Tz1Vb8Nc4Hd6Jf0Gs5Wy2Ea9Ub3Io7Pq";

const POOL_SIZE = 4;

describe.skipIf(!url)("DrizzleExchangeCodes (integration)", () => {
  let client: Sql;
  let db: PostgresJsDatabase<Schema>;
  let codes: DrizzleExchangeCodes;
  let userId: string;

  beforeAll(() => {
    // More than one connection, so the concurrent redemptions below really do
    // run side by side in Postgres rather than queueing on a single socket.
    client = postgres(url!, { max: POOL_SIZE });
    db = drizzle(client, { schema });
    codes = new DrizzleExchangeCodes(db);
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client`truncate table auth_exchange_codes, users restart identity cascade`;
    const [user] = await db
      .insert(users)
      .values({ googleId: "g-integration", email: "hunter@example.com", name: "Lead Hunter" })
      .returning();
    userId = user!.id;
  });

  it("stores only a hash of the exchange code, never the code itself", async () => {
    await codes.save({ code: CODE, userId, expiresAt: new Date("2030-01-01T00:00:00Z") });

    const rows = await client`select * from auth_exchange_codes`;
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(CODE);
  });

  it("hands a stored exchange code to exactly one of several concurrent redemptions", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    await codes.save({ code: CODE, userId, expiresAt });
    // postgres.js opens connections lazily; hold every one open at once first
    // so the redemptions below each get their own and genuinely overlap.
    await Promise.all(Array.from({ length: POOL_SIZE }, () => client`select pg_sleep(0.05)`));

    const results = await Promise.all(Array.from({ length: POOL_SIZE }, () => codes.take(CODE)));

    expect(results.filter((grant) => grant !== undefined)).toEqual([{ userId, expiresAt }]);
    await expect(codes.take(CODE)).resolves.toBeUndefined();
  });
});
