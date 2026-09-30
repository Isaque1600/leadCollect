import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row per person who has signed in with Google. Owned by the identity
 * module (ADR-0008): `drizzle-kit` finds this file by glob, and `src/schema.ts`
 * merges it into the runtime connection object.
 *
 * `monthlyQuotaUsed` tracks Billable Calls spent this month (CONTEXT.md: Quota);
 * it starts at 0 and a later ticket resets it on the 1st.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  monthlyQuotaUsed: integer("monthly_quota_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/**
 * Exchange codes waiting to be traded for a JWT at `POST /auth/exchange`
 * (ticket 19). Keyed by the SHA-256 of the code, never the code itself, so the
 * table is not a list of usable credentials. A row lives about a minute:
 * redemption deletes it, and a user's rows go with the user.
 *
 * Kept in Postgres rather than in memory so a code survives the API restarting
 * between the redirect and the redemption (a Render free instance can).
 */
export const authExchangeCodes = pgTable("auth_exchange_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
