import { Inject, Injectable, Logger } from "@nestjs/common";
import { LEAD_POOL, type LeadPool } from "../../leads/domain/lead-pool.port";
import type { LeadDraft } from "../../leads/domain/lead";
import { composeQueries, type Job } from "../domain/job";
import { JOBS, type Jobs } from "../domain/jobs.port";
import { MAPS_SOURCE, type MapsPlaceDetails, type MapsSource } from "../domain/maps-source.port";

/** `fonte` for everything the Maps Source produces (CONTEXT.md: Source). */
const MAPS_SOURCE_LABEL = "Google Maps" as const;

/**
 * Runs a Job to completion inside the API process (ADR-0003): no queue, no
 * worker, no Redis. Progress is written to the `jobs` row after every step so
 * the SPA's poll of `GET /jobs/:id` has something to show.
 *
 * `run` never rejects — a Job that blows up is a `failed` row with the error
 * text on it, not an unhandled rejection in the process that started it.
 *
 * Out of scope here and left to ticket 09: the one-running-Job-per-user guard,
 * cancellation between queries, and the stuck-Job reaper.
 */
@Injectable()
export class JobRunner {
  private readonly logger = new Logger(JobRunner.name);

  constructor(
    @Inject(JOBS) private readonly jobs: Jobs,
    @Inject(MAPS_SOURCE) private readonly maps: MapsSource,
    @Inject(LEAD_POOL) private readonly leadPool: LeadPool,
  ) {}

  async run(job: Job): Promise<void> {
    try {
      await this.collect(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Job ${job.id} failed: ${message}`);
      await this.jobs.update(job.id, {
        status: "failed",
        currentStep: null,
        error: message,
        finishedAt: new Date(),
      });
    }
  }

  private async collect(job: Job): Promise<void> {
    const queries = composeQueries(job.params);

    await this.jobs.update(job.id, {
      status: "running",
      queriesTotal: queries.length,
      currentStep: "Iniciando busca",
      startedAt: new Date(),
    });

    let queriesDone = 0;
    let leadsFound = 0;
    let apiCallsUsed = 0;
    // Within one Job the same place can come back from two queries; the pool
    // upsert would reuse the Lead anyway, but skipping it here also avoids
    // paying for the details call twice.
    const seenPlaceIds = new Set<string>();

    for (const query of queries) {
      await this.jobs.update(job.id, { currentStep: `Buscando: ${query.text}` });

      const hits = await this.maps.search(query.text, job.params.maxResults);

      for (const hit of hits) {
        if (seenPlaceIds.has(hit.placeId)) {
          continue;
        }
        seenPlaceIds.add(hit.placeId);

        // One Billable Call. Everything after it is database work.
        const details = await this.maps.fetchDetails(hit.placeId);
        apiCallsUsed += 1;

        const lead = await this.leadPool.upsertByPlaceId(
          toLeadDraft(details, query.businessType, hit.name),
        );
        await this.leadPool.collect(job.userId, lead.id);
        leadsFound += 1;

        await this.jobs.update(job.id, {
          leadsFound,
          apiCallsUsed,
          currentStep: `Coletando: ${lead.name}`,
        });
      }

      queriesDone += 1;
      await this.jobs.update(job.id, { queriesDone });
    }

    await this.jobs.update(job.id, {
      status: "done",
      currentStep: null,
      error: null,
      finishedAt: new Date(),
    });
  }
}

/**
 * Places details → the Lead the pool stores. `businessType` is the Job's, not
 * Google's: it is what the user searched for, exactly as `tipo_negocio` came
 * from the query entry in the Python collector's config.
 *
 * `email` stays null — no Enrichment yet (ticket 05).
 */
function toLeadDraft(
  details: MapsPlaceDetails,
  businessType: string,
  fallbackName: string,
): LeadDraft & { placeId: string } {
  return {
    placeId: details.placeId,
    name: details.name || fallbackName,
    phone: details.phone,
    email: null,
    businessType,
    hasWebsite: Boolean(details.website),
    website: details.website,
    sourceUrl: details.sourceUrl,
    source: MAPS_SOURCE_LABEL,
  };
}
