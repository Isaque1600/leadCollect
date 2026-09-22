import type {
  Enrichment,
  EnrichmentTarget,
} from "../../../src/modules/enrichment/domain/enrichment.port";
import type { WebsiteFetcher } from "../../../src/modules/enrichment/domain/website-fetcher.port";

/**
 * A stand-in for the `ENRICHMENT` port: records which Leads a Job handed over,
 * without visiting anything. What Enrichment then *does* with them is
 * `EnrichmentService`'s own spec.
 */
export class FakeEnrichment implements Enrichment {
  readonly enriched: EnrichmentTarget[] = [];

  async enrichCollectedLead(target: EnrichmentTarget): Promise<void> {
    this.enriched.push(target);
  }
}

/**
 * A scripted `WebsiteFetcher`: pages keyed by URL, no network, no delay. A URL
 * that is not in the map reads as unreadable (`null`), the same answer the real
 * fetcher gives for a timeout or a `robots.txt` refusal.
 */
export class FakeWebsiteFetcher implements WebsiteFetcher {
  readonly requested: string[] = [];

  constructor(private readonly pages: Record<string, string> = {}) {}

  async fetchPage(url: string): Promise<string | null> {
    this.requested.push(url);
    return this.pages[url] ?? null;
  }
}
