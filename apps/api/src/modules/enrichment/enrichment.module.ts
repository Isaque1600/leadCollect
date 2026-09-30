import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module";
import { EnrichmentService } from "./application/enrichment.service";
import { ENRICHMENT } from "./domain/enrichment.port";
import { WEBSITE_FETCHER } from "./domain/website-fetcher.port";
import {
  DEFAULT_WEBSITE_FETCHER_OPTIONS,
  HttpWebsiteFetcher,
  WEBSITE_FETCHER_OPTIONS,
} from "./infra/http-website-fetcher";

/**
 * Enrichment (CONTEXT.md): visiting a Lead's website for email, WhatsApp and
 * phone, and re-visiting a Stale Lead in the background.
 *
 * Its own module rather than a corner of `leads` or of `jobs` (ADR-0008): it is
 * the only thing in the API that makes outbound requests to sites we do not
 * own, with the `robots.txt` and delay obligations that come with that, and both
 * the jobs module (today) and the Web Search Source (ticket 06) need it. It
 * imports `LeadsModule` for the `LEAD_POOL` port it writes enrichment back
 * into, so the dependency runs `jobs → enrichment → leads`.
 *
 * Only `ENRICHMENT` is exported; the fetcher and its options stay private.
 */
@Module({
  imports: [LeadsModule],
  providers: [
    { provide: ENRICHMENT, useClass: EnrichmentService },
    { provide: WEBSITE_FETCHER, useClass: HttpWebsiteFetcher },
    { provide: WEBSITE_FETCHER_OPTIONS, useValue: DEFAULT_WEBSITE_FETCHER_OPTIONS },
  ],
  exports: [ENRICHMENT],
})
export class EnrichmentModule {}
