import { pgTable, boolean, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "../../identity/infra/identity.schema";

/**
 * The global Lead Pool and the Collected Leads that link users to it (ADR-0002).
 * Owned by the leads module: `drizzle-kit` finds this file by glob and
 * `src/schema.ts` merges it into the runtime connection object (ADR-0008).
 *
 * Only tables are exported from a `*.schema.ts` file — `src/schema.ts` spreads
 * it wholesale into the Drizzle handle.
 *
 * `user_leads.user_id` references the identity module's `users` table. Drizzle
 * expresses a foreign key by referencing the table object, so the import is the
 * only way to keep referential integrity in the one database these modules
 * share; the alternative — a bare `uuid` column — would trade a real constraint
 * for a cosmetic boundary.
 */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * The Lead Identity for the Maps Source: the Google `place_id`. Unique, so the
   * upsert can dedupe on it. Nullable because the Web Search Source (ticket 06)
   * identifies Leads by normalized domain instead — Postgres allows many NULLs
   * under a unique constraint.
   */
  placeId: text("place_id").unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  businessType: text("business_type"),
  hasWebsite: boolean("has_website").notNull().default(false),
  website: text("website"),
  sourceUrl: text("source_url"),
  /** `fonte`: "Google Maps" or "Busca Web" — the value the export shows. */
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A Collected Lead: this user pulled this Lead out of the pool, and when. The
 * unique constraint makes collecting the same Lead twice a no-op rather than a
 * duplicate in the user's list.
 */
export const userLeads = pgTable(
  "user_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("user_leads_user_id_lead_id_key").on(table.userId, table.leadId)],
);

export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type UserLeadRow = typeof userLeads.$inferSelect;
