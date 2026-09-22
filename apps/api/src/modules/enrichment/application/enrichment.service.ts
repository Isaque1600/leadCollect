import { Inject, Injectable, Logger } from "@nestjs/common";
import { LEAD_POOL, type LeadPool } from "../../leads/domain/lead-pool.port";
import { extractContacts, NO_CONTACTS, pickPhone } from "../domain/contact-extraction";
import type { Enrichment, EnrichmentTarget } from "../domain/enrichment.port";
import { isNeverEnriched, isStale } from "../domain/staleness";
import { WEBSITE_FETCHER, type WebsiteFetcher } from "../domain/website-fetcher.port";

/**
 * Enrichment (CONTEXT.md), ported from `collector_maps.py`'s
 * `extrair_contatos_do_site` step (ADR-0004): visit the Lead's website, pattern
 * match email / WhatsApp / phone out of the HTML, write them back to the Lead
 * Pool record in place.
 *
 * The policy in `enrichCollectedLead` is the whole of ticket 05's behaviour:
 *
 * - no website → nothing to visit, the Lead is left exactly as Places gave it;
 * - never enriched → enriched **now**, awaited, because the user is waiting on
 *   the Job that just collected it and an unenriched Lead has no email;
 * - a Stale Lead (Enrichment older than 30 days) → re-enriched in the
 *   background, not awaited, so a Job that mostly re-finds known Leads is not
 *   held up by dozens of site visits;
 * - enriched recently → nothing at all, which is what keeps a busy Lead Pool
 *   from re-crawling the same sites every Job.
 *
 * "Background" here is a floating promise, the same non-mechanism
 * `StartMapsJobUseCase` uses for the Job itself: ADR-0003 rejected a broker on
 * purpose, and `@nestjs/schedule` schedules *recurring* work, which this is not.
 * The promise cannot reject — `refresh` catches everything — so it cannot take
 * the process down.
 */
@Injectable()
export class EnrichmentService implements Enrichment {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    @Inject(WEBSITE_FETCHER) private readonly fetcher: WebsiteFetcher,
    @Inject(LEAD_POOL) private readonly leadPool: LeadPool,
  ) {}

  async enrichCollectedLead(target: EnrichmentTarget): Promise<void> {
    if (target.website === null || target.website === "") {
      return;
    }

    if (isNeverEnriched(target.enrichedAt)) {
      await this.refresh(target);
      return;
    }

    if (isStale(target.enrichedAt)) {
      void this.refresh(target);
    }
  }

  /**
   * One visit, then one write. Never throws: a site that will not load is a Lead
   * without an email, not a failed Job — the Python collector swallowed these
   * the same way.
   *
   * `enrichedAt` is stamped even when the site yielded nothing, so a dead site
   * is not re-visited on every single Job for the next 30 days.
   */
  private async refresh(target: EnrichmentTarget): Promise<void> {
    try {
      const html = await this.fetcher.fetchPage(target.website!);
      const contacts = html === null ? NO_CONTACTS : extractContacts(html);

      await this.leadPool.recordEnrichment(target.id, {
        // A found value wins; nothing found leaves what the Lead already had,
        // so one bad visit cannot erase a good email collected months ago.
        email: contacts.email ?? target.email,
        phone: pickPhone(contacts, target.phone),
        enrichedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Enrichment of lead ${target.id} failed: ${message}`);
    }
  }
}
