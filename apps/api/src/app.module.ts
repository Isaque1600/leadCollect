import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { AppConfigModule } from "./shared/config/config.module";
import { DbModule } from "./shared/db/db.module";

/**
 * The composition root: shared infrastructure first, then one import per module
 * (ADR-0008). Nothing else knows the full list.
 */
@Module({
  imports: [AppConfigModule, DbModule, IdentityModule, LeadsModule, JobsModule, HealthModule],
})
export class AppModule {}
