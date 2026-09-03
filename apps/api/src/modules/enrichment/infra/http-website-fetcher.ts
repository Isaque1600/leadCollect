import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { isAllowed, parseRobotsTxt, robotsTxtUrl, ALLOW_EVERYTHING } from "../domain/robots-txt";
import type { WebsiteFetcher } from "../domain/website-fetcher.port";

/** Injection token for {@link WebsiteFetcherOptions}; the module provides defaults. */
export const WEBSITE_FETCHER_OPTIONS = Symbol("WebsiteFetcherOptions");

export interface WebsiteFetcherOptions {
  /** `DELAY_ENTRE_REQUISICOES` — the pause between two outgoing site requests. */
  delayMs: number;
  /** `TIMEOUT_SITE`. */
  timeoutMs: number;
  /** What we announce ourselves as, to robots.txt and to the server. */
  userAgent: string;
}

/**
 * The Python collector's constants, kept as they were (ADR-0004): half a second
 * between requests, a ten second timeout, and the same LeadBot User-Agent.
 */
export const DEFAULT_WEBSITE_FETCHER_OPTIONS: WebsiteFetcherOptions = {
  delayMs: 500,
  timeoutMs: 10_000,
  userAgent: "Mozilla/5.0 (compatible; LeadBot/1.0)",
};

/** The agent token a `robots.txt` group has to name to be about us. */
const ROBOTS_AGENT = "leadbot";

/**
 * Enrichment's window onto the web: `pode_acessar` + the `requests.get` in
 * `extrair_contatos_do_site`, together, because they are one polite visit and
 * splitting them would let a caller skip the `robots.txt` half.
 *
 * The delay is enforced here rather than by the caller, and it spaces *every*
 * outgoing request including the `robots.txt` one, so no amount of concurrency
 * upstream turns Enrichment into a hammering crawler.
 *
 * Uses the platform `fetch` (Node 22) — no HTTP client dependency, same as the
 * Maps Source.
 */
@Injectable()
export class HttpWebsiteFetcher implements WebsiteFetcher {
  private readonly logger = new Logger(HttpWebsiteFetcher.name);

  /** The tail of the request chain, so requests queue behind one another. */
  private queue: Promise<unknown> = Promise.resolve();

  private readonly options: WebsiteFetcherOptions;

  constructor(
    @Optional() @Inject(WEBSITE_FETCHER_OPTIONS) options?: Partial<WebsiteFetcherOptions>,
  ) {
    this.options = { ...DEFAULT_WEBSITE_FETCHER_OPTIONS, ...options };
  }

  async fetchPage(url: string): Promise<string | null> {
    if (!(await this.mayFetch(url))) {
      this.logger.debug(`robots.txt disallows ${url}`);
      return null;
    }

    return this.get(url);
  }

  /**
   * `pode_acessar`: read the host's `robots.txt` and ask it about this URL. Any
   * trouble at all — no file, a 500, a timeout — is treated as permission, which
   * is precisely what the Python `except: return True` did.
   */
  private async mayFetch(url: string): Promise<boolean> {
    const robotsUrl = robotsTxtUrl(url);
    if (robotsUrl === null) {
      return true;
    }

    const body = await this.get(robotsUrl);
    const rules = body === null ? ALLOW_EVERYTHING : parseRobotsTxt(body, ROBOTS_AGENT);
    return isAllowed(rules, url);
  }

  /** One throttled GET. Returns the body as text, or null for anything unhappy. */
  private async get(url: string): Promise<string | null> {
    await this.waitTurn();

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.options.userAgent },
        redirect: "follow",
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      if (!response.ok) {
        return null;
      }
      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Could not read ${url}: ${message}`);
      return null;
    }
  }

  /**
   * Serialises requests and puts `delayMs` between them. Chaining onto `queue`
   * rather than sleeping in place means two Leads enriched at once still leave
   * the delay between their requests instead of firing together.
   */
  private waitTurn(): Promise<void> {
    const turn = this.queue.then(() => sleep(this.options.delayMs));
    this.queue = turn;
    return turn;
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
