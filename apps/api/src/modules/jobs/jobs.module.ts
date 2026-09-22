import { Module } from "@nestjs/common";
import { EnrichmentModule } from "../enrichment/enrichment.module";
import { IdentityModule } from "../identity/identity.module";
import { LeadsModule } from "../leads/leads.module";
import { JobsController } from "./api/jobs.controller";
import { JobRunner } from "./application/job-runner.service";
import { StartMapsJobUseCase } from "./application/start-maps-job.use-case";
import { JOBS } from "./domain/jobs.port";
import { MAPS_SOURCE } from "./domain/maps-source.port";
import { DrizzleJobsRepository } from "./infra/drizzle-jobs.repository";
import { GooglePlacesMapsSource } from "./infra/google-places.maps-source";

/**
 * Running a search: the `jobs` table, the in-process runner (ADR-0003), and the
 * Maps Source that talks to Google Places.
 *
 * Imports `IdentityModule` for `JwtAuthGuard` — its routes are the signed-in
 * user's — `LeadsModule` for the `LEAD_POOL` port it writes into, and
 * `EnrichmentModule` for the `ENRICHMENT` port every collected Lead goes
 * through. Nothing
 * is exported yet: ticket 10's export reads Collected Leads through the leads
 * module, not through this one.
 */
@Module({
  imports: [IdentityModule, LeadsModule, EnrichmentModule],
  controllers: [JobsController],
  providers: [
    StartMapsJobUseCase,
    JobRunner,
    { provide: JOBS, useClass: DrizzleJobsRepository },
    { provide: MAPS_SOURCE, useClass: GooglePlacesMapsSource },
  ],
})
export class JobsModule {}
