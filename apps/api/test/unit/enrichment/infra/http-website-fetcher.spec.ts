import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpWebsiteFetcher } from "../../../../src/modules/enrichment/infra/http-website-fetcher";

const SITE = "https://clinica.com.br/contato";

/**
 * Stubs the platform `fetch` with a map of URL → body. A URL that is not in the
 * map answers 404, which is how "this host has no robots.txt" is expressed.
 */
function stubWeb(pages: Record<string, string>) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const body = pages[url];
    return body === undefined
      ? { ok: false, status: 404, text: async () => "" }
      : { ok: true, status: 200, text: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** No delay in tests; the real one is half a second, as in the Python script. */
function fetcher() {
  return new HttpWebsiteFetcher({ delayMs: 0 });
}

describe("HttpWebsiteFetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks robots.txt before it reads the page", async () => {
    const fetchMock = stubWeb({ [SITE]: "<p>olá</p>" });

    expect(await fetcher().fetchPage(SITE)).toBe("<p>olá</p>");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://clinica.com.br/robots.txt",
      SITE,
    ]);
  });

  it("does not read a page robots.txt disallows", async () => {
    const fetchMock = stubWeb({
      "https://clinica.com.br/robots.txt": "User-agent: *\nDisallow: /contato",
      [SITE]: "<p>olá</p>",
    });

    expect(await fetcher().fetchPage(SITE)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a missing robots.txt as permission, like the Python collector", async () => {
    stubWeb({ [SITE]: "<p>olá</p>" });

    expect(await fetcher().fetchPage(SITE)).toBe("<p>olá</p>");
  });

  it("returns null instead of throwing when the site refuses or vanishes", async () => {
    stubWeb({});
    expect(await fetcher().fetchPage(SITE)).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ENOTFOUND");
      }),
    );
    expect(await fetcher().fetchPage(SITE)).toBeNull();
  });

  it("announces itself with the collector's User-Agent", async () => {
    const fetchMock = stubWeb({ [SITE]: "<p>olá</p>" });

    await fetcher().fetchPage(SITE);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });
  });

  it("leaves the configured delay between two outgoing requests", async () => {
    stubWeb({ [SITE]: "<p>olá</p>" });
    const started = Date.now();

    // robots.txt + the page = two requests, so one delay each.
    await new HttpWebsiteFetcher({ delayMs: 20 }).fetchPage(SITE);

    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });
});
