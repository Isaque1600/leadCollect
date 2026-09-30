/** Injection token for the {@link WebsiteFetcher} port. */
export const WEBSITE_FETCHER = Symbol("WebsiteFetcher");

/**
 * The one way Enrichment touches the outside web. Everything that makes visiting
 * a stranger's website polite — the `robots.txt` check, the delay between
 * requests, the timeout, the User-Agent — lives behind this port, so the
 * application layer never has to remember any of it and tests never hit the
 * network.
 */
export interface WebsiteFetcher {
  /**
   * The page's HTML, or `null` when it must not or cannot be read: `robots.txt`
   * disallows it, the request timed out, the host is gone, the response was not
   * a success. A Lead whose site cannot be read is simply not enriched — never
   * an error that fails the Job.
   */
  fetchPage(url: string): Promise<string | null>;
}
