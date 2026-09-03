import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "../../identity/infra/identity.schema";
import type { JobParams, JobStatus } from "../domain/job";

/**
 * One row per Job. Status and progress live here and the SPA polls them — that
 * *is* the queue (ADR-0003). Owned by the jobs module; `drizzle-kit` finds this
 * file by glob and `src/schema.ts` merges it (ADR-0008).
 *
 * `status` is plain `text` with the union narrowed in TypeScript rather than a
 * Postgres enum: ticket 09 adds `cancelled` and a `pgEnum` would make that an
 * `ALTER TYPE` migration for no gain at this size.
 *
 * `params` is `jsonb` because the shape grows — ticket 06 adds a `sources` list
 * — and nothing queries inside it yet.
 */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").$type<JobStatus>().notNull().default("queued"),
  params: jsonb("params").$type<JobParams>().notNull(),
  queriesTotal: integer("queries_total").notNull().default(0),
  queriesDone: integer("queries_done").notNull().default(0),
  leadsFound: integer("leads_found").notNull().default(0),
  /** Billable Calls spent by this Job (CONTEXT.md). */
  apiCallsUsed: integer("api_calls_used").notNull().default(0),
  currentStep: text("current_step"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
