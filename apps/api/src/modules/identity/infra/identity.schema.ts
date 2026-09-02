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
