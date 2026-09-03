import { Module } from "@nestjs/common";
import { LEAD_POOL } from "./domain/lead-pool.port";
import { DrizzleLeadPoolRepository } from "./infra/drizzle-lead-pool.repository";

/**
 * The global Lead Pool (ADR-0002): the `leads` table every user shares and the
 * `user_leads` links that record which Leads each user collected.
 *
 * `exports` is the module's public surface (ADR-0008) — the jobs module takes
 * the `LEAD_POOL` port to store what a Source found; the Drizzle adapter stays
 * private. There is no controller yet: reading and exporting Collected Leads
 * arrives with ticket 10.
 */
@Module({
  providers: [{ provide: LEAD_POOL, useClass: DrizzleLeadPoolRepository }],
  exports: [LEAD_POOL],
})
export class LeadsModule {}
