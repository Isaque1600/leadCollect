import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo, LookupFunction } from "node:net";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  HttpWebsiteFetcher,
  type WebsiteFetcherOptions,
} from "../../../../src/modules/enrichment/infra/http-website-fetcher";

/**
 * The fetcher speaks real HTTP (`node:http`), so these specs run it against a
 * real server — in-process, on loopback, on a random port. No outside network
 * is touched.
 *
 * Loopback is exactly what the fetcher refuses by default, so most specs widen
 * `isAllowedAddress` to `127.0.0.1` alone and reach the server through a fake
 * `lookup` that resolves `clinica.test` there. The SSRF specs use the default
 * policy, or point elsewhere, to show the refusal.
 */
type Handler = (request: IncomingMessage, response: ServerResponse) => void;

interface TestSite {
  /** `http://clinica.test:<port>` */
  origin: string;
  port: number;
  /** Every path the server was asked for, in order. */
  requested: string[];
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

/** Starts a server whose routes are keyed by path; unknown paths answer 404. */
async function serve(routes: Record<string, Handler | string>): Promise<TestSite> {
  const requested: string[] = [];
  const server = createServer((request, response) => {
    requested.push(request.url ?? "");
    const route = routes[request.url ?? ""];
    if (route === undefined) {
      response.writeHead(404).end();
    } else if (typeof route === "string") {
      response.writeHead(200, { "Content-Type": "text/html" }).end(route);
    } else {
      route(request, response);
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { origin: `http://clinica.test:${port}`, port, requested };
}

/** `dns.lookup` stand-in: a fixed name → address table, anything else ENOTFOUND. */
function fakeDns(table: Record<string, string>): LookupFunction & { asked: string[] } {
  const asked: string[] = [];
  const lookup = ((hostname, options, callback) => {
    asked.push(hostname);
    const address = table[hostname];
    if (address === undefined) {
      callback(Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" }), "");
      return;
    }
    const family = address.includes(":") ? 6 : 4;
    if (options.all) {
      callback(null, [{ address, family }]);
    } else {
      callback(null, address, family);
    }
  }) as LookupFunction & { asked: string[] };
  lookup.asked = asked;
  return lookup;
}

/** A fetcher that may reach the loopback test server and nothing else private. */
function fetcher(options: Partial<WebsiteFetcherOptions> = {}) {
  return new HttpWebsiteFetcher({
    delayMs: 0,
    isAllowedAddress: (address) => address === "127.0.0.1",
    lookup: fakeDns({ "clinica.test": "127.0.0.1" }),
    ...options,
  });
}

function redirectTo(location: string): Handler {
  return (_request, response) => response.writeHead(302, { Location: location }).end();
}

function status(code: number): Handler {
  return (_request, response) => response.writeHead(code).end();
}

describe("HttpWebsiteFetcher", () => {
  it("checks robots.txt before it reads the page", async () => {
    const site = await serve({ "/contato": "<p>olá</p>" });

    expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBe("<p>olá</p>");
    expect(site.requested).toEqual(["/robots.txt", "/contato"]);
  });

  it("does not read a page robots.txt disallows", async () => {
    const site = await serve({
      "/robots.txt": "User-agent: *\nDisallow: /contato",
      "/contato": "<p>olá</p>",
    });

    expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBeNull();
    expect(site.requested).toEqual(["/robots.txt"]);
  });

  it("treats a missing robots.txt as permission, like the Python collector", async () => {
    const site = await serve({ "/contato": "<p>olá</p>" });

    expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBe("<p>olá</p>");
  });

  it.each([401, 403])(
    "treats a %i robots.txt as disallow-all, as urllib.robotparser does",
    async (code) => {
      const site = await serve({ "/robots.txt": status(code), "/contato": "<p>olá</p>" });

      expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBeNull();
      expect(site.requested).toEqual(["/robots.txt"]);
    },
  );

  it.each([404, 410, 429])("treats a %i robots.txt as allow-all", async (code) => {
    const site = await serve({ "/robots.txt": status(code), "/contato": "<p>olá</p>" });

    expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBe("<p>olá</p>");
  });

  it("returns null instead of throwing when the site errors or vanishes", async () => {
    const site = await serve({ "/contato": status(500) });
    expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBeNull();

    // A name that does not resolve.
    expect(await fetcher().fetchPage("http://gone.test/")).toBeNull();
  });

  it("announces itself with the collector's User-Agent", async () => {
    let userAgent: string | undefined;
    const site = await serve({
      "/contato": (request, response) => {
        userAgent = request.headers["user-agent"];
        response.end("<p>olá</p>");
      },
    });

    await fetcher().fetchPage(`${site.origin}/contato`);

    expect(userAgent).toBe("Mozilla/5.0 (compatible; LeadBot/1.0)");
  });

  it("leaves the configured delay between two outgoing requests", async () => {
    const site = await serve({ "/contato": "<p>olá</p>" });
    const started = Date.now();

    // robots.txt + the page = two requests, so one delay each.
    await fetcher({ delayMs: 20 }).fetchPage(`${site.origin}/contato`);

    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });

  it("decompresses a gzip-encoded page", async () => {
    const site = await serve({
      "/contato": (_request, response) =>
        response
          .writeHead(200, { "Content-Encoding": "gzip" })
          .end(gzipSync("<p>contato@clinica.com.br</p>")),
    });

    expect(await fetcher().fetchPage(`${site.origin}/contato`)).toBe(
      "<p>contato@clinica.com.br</p>",
    );
  });

  describe("SSRF fence", () => {
    it.each(["data:text/html,x@y.com", "file:///etc/passwd", "ftp://clinica.test/", "not a url"])(
      "refuses a non-http(s) URL without requesting anything: %s",
      async (url) => {
        const lookup = fakeDns({ "clinica.test": "127.0.0.1" });

        expect(await fetcher({ lookup }).fetchPage(url)).toBeNull();
        expect(lookup.asked).toEqual([]);
      },
    );

    it("refuses a loopback IP-literal host under the default policy", async () => {
      const site = await serve({ "/": "segredo" });
      const guarded = new HttpWebsiteFetcher({ delayMs: 0 });

      expect(await guarded.fetchPage(`http://127.0.0.1:${site.port}/`)).toBeNull();
      expect(await guarded.fetchPage(`http://[::ffff:127.0.0.1]:${site.port}/`)).toBeNull();
      expect(site.requested).toEqual([]);
    });

    it("refuses localhost, because what it resolves to is loopback", async () => {
      const site = await serve({ "/": "segredo" });

      // Real `dns.lookup`: the check is on the resolved address, not the name.
      expect(
        await new HttpWebsiteFetcher({ delayMs: 0 }).fetchPage(`http://localhost:${site.port}/`),
      ).toBeNull();
      expect(site.requested).toEqual([]);
    });

    it("checks the address a name resolves to, not the name", async () => {
      const lookup = fakeDns({
        "intranet.test": "10.0.0.5",
        "metadata.test": "169.254.169.254",
        "v6.test": "fd00:ec2::254",
      });
      const guarded = new HttpWebsiteFetcher({ delayMs: 0, lookup });

      expect(await guarded.fetchPage("http://intranet.test/")).toBeNull();
      expect(await guarded.fetchPage("http://metadata.test/latest/meta-data/")).toBeNull();
      expect(await guarded.fetchPage("http://v6.test/")).toBeNull();
      expect(lookup.asked).toEqual(expect.arrayContaining(["intranet.test", "metadata.test"]));
    });

    it("follows a redirect that stays on allowed ground", async () => {
      const site = await serve({
        "/": redirectTo("/contato"),
        "/contato": "<p>olá</p>",
      });

      expect(await fetcher().fetchPage(`${site.origin}/`)).toBe("<p>olá</p>");
    });

    it("re-checks every redirect hop, by scheme and by address", async () => {
      const site = await serve({
        "/to-ip": redirectTo("http://127.0.0.2/"),
        "/to-name": redirectTo("http://intranet.test/"),
        "/to-file": redirectTo("file:///etc/passwd"),
      });
      const lookup = fakeDns({ "clinica.test": "127.0.0.1", "intranet.test": "10.0.0.5" });

      expect(await fetcher({ lookup }).fetchPage(`${site.origin}/to-ip`)).toBeNull();
      expect(await fetcher({ lookup }).fetchPage(`${site.origin}/to-name`)).toBeNull();
      expect(await fetcher({ lookup }).fetchPage(`${site.origin}/to-file`)).toBeNull();
      expect(lookup.asked).toContain("intranet.test");
    });

    it("gives up after maxRedirects hops", async () => {
      const site = await serve({ "/loop": redirectTo("/loop") });

      expect(await fetcher({ maxRedirects: 3 }).fetchPage(`${site.origin}/loop`)).toBeNull();
      // robots.txt (404), then the first request and three followed redirects.
      expect(site.requested).toEqual(["/robots.txt", "/loop", "/loop", "/loop", "/loop"]);
    });
  });

  describe("size cap", () => {
    it("refuses a body whose Content-Length is over the cap", async () => {
      const site = await serve({ "/contato": "x".repeat(2048) });

      expect(await fetcher({ maxBodyBytes: 1024 }).fetchPage(`${site.origin}/contato`)).toBeNull();
    });

    it("aborts an endless stream at the cap instead of buffering it", async () => {
      let closedEarly = false;
      const site = await serve({
        "/contato": (_request, response) => {
          response.writeHead(200, { "Content-Type": "text/html" });
          response.on("close", () => (closedEarly = !response.writableFinished));
          // No Content-Length and no end: only the cap can stop this.
          const timer = setInterval(() => response.write("x".repeat(512)), 1);
          response.on("close", () => clearInterval(timer));
        },
      });

      expect(await fetcher({ maxBodyBytes: 4096 }).fetchPage(`${site.origin}/contato`)).toBeNull();
      await expect.poll(() => closedEarly).toBe(true);
    });

    it("counts decompressed bytes, so a small gzip bomb is capped too", async () => {
      const bomb = gzipSync("x".repeat(1024 * 1024));
      const site = await serve({
        "/contato": (_request, response) =>
          response.writeHead(200, { "Content-Encoding": "gzip" }).end(bomb),
      });

      expect(bomb.length).toBeLessThan(4096);
      expect(await fetcher({ maxBodyBytes: 4096 }).fetchPage(`${site.origin}/contato`)).toBeNull();
    });

    it("reads a page at the cap", async () => {
      const site = await serve({ "/contato": "x".repeat(1024) });

      expect(await fetcher({ maxBodyBytes: 1024 }).fetchPage(`${site.origin}/contato`)).toBe(
        "x".repeat(1024),
      );
    });
  });
});
