import { lookup as dnsLookup } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { pipeline, type Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { isAllowed, robotsRulesFor, robotsTxtUrl } from "../domain/robots-txt";
import type { WebsiteFetcher } from "../domain/website-fetcher.port";
import { guardedLookup, isPublicAddress, NonPublicAddressError } from "./public-address";

/** Injection token for {@link WebsiteFetcherOptions}; the module provides defaults. */
export const WEBSITE_FETCHER_OPTIONS = Symbol("WebsiteFetcherOptions");

export interface WebsiteFetcherOptions {
  /** `DELAY_ENTRE_REQUISICOES` — the pause between two outgoing site requests. */
  delayMs: number;
  /** `TIMEOUT_SITE` — for one whole visit to a URL, redirects and body included. */
  timeoutMs: number;
  /** What we announce ourselves as, to robots.txt and to the server. */
  userAgent: string;
  /** Past this many (decoded) bytes the download is aborted and the page is unreadable. */
  maxBodyBytes: number;
  /** How many redirects one visit follows; each hop is re-checked in full. */
  maxRedirects: number;
  /**
   * May a socket be opened to this IP? Public unicast only, by default — see
   * `public-address.ts`. Tests widen it to reach a server on loopback.
   */
  isAllowedAddress: (address: string) => boolean;
  /** Name resolution, `dns.lookup` by default; a seam for tests. */
  lookup: LookupFunction;
}

/**
 * The Python collector's constants, kept as they were (ADR-0004): half a second
 * between requests, a ten second timeout, and the same LeadBot User-Agent. The
 * size cap and redirect limit are this port's own — `requests` had neither.
 */
export const DEFAULT_WEBSITE_FETCHER_OPTIONS: WebsiteFetcherOptions = {
  delayMs: 500,
  timeoutMs: 10_000,
  userAgent: "Mozilla/5.0 (compatible; LeadBot/1.0)",
  maxBodyBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
  isAllowedAddress: isPublicAddress,
  lookup: dnsLookup as LookupFunction,
};

/** The agent token a `robots.txt` group has to name to be about us. */
const ROBOTS_AGENT = "leadbot";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** What one visit to a URL produced, after redirects. */
interface FetchedResponse {
  status: number;
  body: string;
}

/**
 * Enrichment's window onto the web: `pode_acessar` + the `requests.get` in
 * `extrair_contatos_do_site`, together, because they are one polite visit and
 * splitting them would let a caller skip the `robots.txt` half.
 *
 * The delay is enforced here rather than by the caller, and it spaces *every*
 * outgoing request including the `robots.txt` one, so no amount of concurrency
 * upstream turns Enrichment into a hammering crawler.
 *
 * Every URL here comes from outside (Places today, web search from ticket 06),
 * so a visit is also fenced in:
 *
 * - `http:` and `https:` only — no `data:`, `file:` or anything else;
 * - the socket only ever connects to a public address: the check runs inside
 *   the `lookup` the socket itself uses (and on IP-literal hosts, which skip
 *   `lookup`), so a hostname cannot resolve to one address when checked and to
 *   `127.0.0.1` when connected (DNS rebinding);
 * - redirects are followed by hand, at most `maxRedirects`, and every hop goes
 *   through the same scheme and address checks;
 * - the body is streamed and the download aborted past `maxBodyBytes` (counted
 *   after decompression, so a gzip bomb stops at the cap too).
 *
 * That is why this uses `node:http`/`node:https` rather than the platform
 * `fetch` the Maps Source uses: Node's `fetch` takes no custom `lookup` without
 * the `undici` package, and `node:http` does, with no dependency at all.
 */
@Injectable()
export class HttpWebsiteFetcher implements WebsiteFetcher {
  private readonly logger = new Logger(HttpWebsiteFetcher.name);

  /** The tail of the request chain, so requests queue behind one another. */
  private queue: Promise<unknown> = Promise.resolve();

  private readonly options: WebsiteFetcherOptions;
  private readonly lookup: LookupFunction;

  constructor(
    @Optional() @Inject(WEBSITE_FETCHER_OPTIONS) options?: Partial<WebsiteFetcherOptions>,
  ) {
    this.options = { ...DEFAULT_WEBSITE_FETCHER_OPTIONS, ...options };
    this.lookup = guardedLookup(this.options.isAllowedAddress, this.options.lookup);
  }

  async fetchPage(url: string): Promise<string | null> {
    if (!isWebUrl(url)) {
      this.logger.debug(`Not an http(s) URL, not visiting: ${url}`);
      return null;
    }

    if (!(await this.mayFetch(url))) {
      this.logger.debug(`robots.txt disallows ${url}`);
      return null;
    }

    const response = await this.get(url);
    return response !== null && isSuccess(response.status) ? response.body : null;
  }

  /**
   * `pode_acessar`: read the host's `robots.txt` and ask it about this URL. How
   * each status reads — 401/403 shut the site, other trouble lets us in — is
   * `robotsRulesFor`'s call.
   */
  private async mayFetch(url: string): Promise<boolean> {
    const robotsUrl = robotsTxtUrl(url);
    if (robotsUrl === null) {
      return true;
    }

    const response = await this.get(robotsUrl);
    const rules = robotsRulesFor(response?.status ?? null, response?.body ?? null, ROBOTS_AGENT);
    return isAllowed(rules, url);
  }

  /**
   * One throttled visit to a URL, redirects followed. Returns the final status
   * and body, or null for anything that did not end in a response — a refused
   * scheme or address, too many redirects, a timeout, an oversized body.
   */
  private async get(url: string): Promise<FetchedResponse | null> {
    await this.waitTurn();
    const signal = AbortSignal.timeout(this.options.timeoutMs);

    try {
      let target = new URL(url);
      for (let redirects = 0; ; redirects += 1) {
        const response = await this.request(target, signal);
        const location = response.headers.location;

        if (REDIRECT_STATUSES.has(response.statusCode ?? 0) && location) {
          // Not drained: a redirect's body is nothing we want, however long.
          response.destroy();
          if (redirects >= this.options.maxRedirects) {
            throw new Error(`more than ${this.options.maxRedirects} redirects`);
          }
          target = new URL(location, target);
          continue;
        }

        const body = await readBody(response, this.options.maxBodyBytes, signal);
        return { status: response.statusCode ?? 0, body };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Could not read ${url}: ${message}`);
      return null;
    }
  }

  /** One HTTP exchange with no redirect handling, fenced by scheme and address. */
  private request(target: URL, signal: AbortSignal): Promise<IncomingMessage> {
    if (!isWebUrl(target.href)) {
      return Promise.reject(new Error(`refusing non-http(s) URL ${target.protocol}`));
    }

    // An IP-literal host never goes through `lookup`, so it is checked here.
    const host = target.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) !== 0 && !this.options.isAllowedAddress(host)) {
      return Promise.reject(new NonPublicAddressError(`refusing non-public address ${host}`));
    }

    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const request = send(target, {
        method: "GET",
        headers: {
          "User-Agent": this.options.userAgent,
          "Accept-Encoding": "gzip, deflate, br",
        },
        lookup: this.lookup,
        // A fresh connection per request: a pooled socket would skip `lookup`.
        agent: false,
        signal,
      });
      request.once("response", resolve);
      // `on`, not `once`: an abort after the response arrived must still land
      // on a listener rather than surface as an uncaught 'error'.
      request.on("error", reject);
      request.end();
    });
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

function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * The response body as UTF-8 text (what `fetch`'s `.text()` gave before),
 * decompressed, and never more than `maxBytes` of it: the stream is torn down
 * the moment the count passes the cap, so nothing past it is buffered.
 */
async function readBody(
  response: IncomingMessage,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const tooLarge = () => new Error(`body larger than ${maxBytes} bytes`);

  const declared = Number(response.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    response.destroy();
    throw tooLarge();
  }

  const decoded = decode(response);
  const abort = () => decoded.destroy(signal.reason as Error);
  signal.addEventListener("abort", abort, { once: true });

  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of decoded) {
      const buffer = chunk as Buffer;
      size += buffer.length;
      if (size > maxBytes) {
        throw tooLarge();
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    signal.removeEventListener("abort", abort);
    // Leaving the loop early (cap, error) must close the connection too.
    decoded.destroy();
    response.destroy();
  }
}

/** The response stream, run through the decompressor its `Content-Encoding` names. */
function decode(response: IncomingMessage): Readable {
  const encoding = (response.headers["content-encoding"] ?? "identity").trim().toLowerCase();
  const decompressor =
    encoding === "gzip" || encoding === "x-gzip"
      ? createGunzip()
      : encoding === "deflate"
        ? createInflate()
        : encoding === "br"
          ? createBrotliDecompress()
          : null;

  if (decompressor === null) {
    if (encoding !== "identity" && encoding !== "") {
      response.destroy();
      throw new Error(`unsupported Content-Encoding ${encoding}`);
    }
    return response;
  }
  // `pipeline` rather than `pipe`: an error or a destroy on either end tears
  // down both, so an aborted download cannot leave the socket open.
  return pipeline(response, decompressor, () => {});
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
