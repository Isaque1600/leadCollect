import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row per person who has signed in with Google.
 * `monthlyQuotaUsed` tracks Billable Calls spent this month (CONTEXT.md: Quota);
 * it starts at 0 and later tickets reset it on the 1st.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  monthlyQuotaUsed: integer("monthly_quota_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
