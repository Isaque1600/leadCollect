import { describe, expect, it } from "vitest";
import {
  isAllowed,
  parseRobotsTxt,
  robotsTxtUrl,
  ALLOW_EVERYTHING,
} from "../../../../src/modules/enrichment/domain/robots-txt";

/** Convenience: parse and ask in one go, as the fetcher does. */
function mayFetch(robots: string, url: string, agent = "leadbot"): boolean {
  return isAllowed(parseRobotsTxt(robots, agent), url);
}

describe("robotsTxtUrl", () => {
  it("points at the host root, whatever the page path was", () => {
    expect(robotsTxtUrl("https://clinica.com.br/contato/equipe")).toBe(
      "https://clinica.com.br/robots.txt",
    );
  });

  it("keeps the port, which is part of the host for robots purposes", () => {
    expect(robotsTxtUrl("http://localhost:8080/x")).toBe("http://localhost:8080/robots.txt");
  });

  it("is null for something that is not a URL", () => {
    expect(robotsTxtUrl("nao é uma url")).toBeNull();
  });
});

describe("parseRobotsTxt + isAllowed", () => {
  it("allows everything when there is no file to parse", () => {
    expect(isAllowed(ALLOW_EVERYTHING, "https://clinica.com.br/qualquer")).toBe(true);
  });

  it("allows everything when no group applies to us", () => {
    const robots = "User-agent: Googlebot\nDisallow: /";
    expect(mayFetch(robots, "https://clinica.com.br/")).toBe(true);
  });

  it("honours a blanket disallow in the * group", () => {
    const robots = "User-agent: *\nDisallow: /";
    expect(mayFetch(robots, "https://clinica.com.br/contato")).toBe(false);
  });

  it("disallows only the matching path prefix", () => {
    const robots = "User-agent: *\nDisallow: /admin";
    expect(mayFetch(robots, "https://clinica.com.br/admin/login")).toBe(false);
    expect(mayFetch(robots, "https://clinica.com.br/contato")).toBe(true);
  });

  it("lets the first matching rule decide, as CPython's parser does", () => {
    const robots = "User-agent: *\nAllow: /admin/publico\nDisallow: /admin";
    expect(mayFetch(robots, "https://clinica.com.br/admin/publico")).toBe(true);
    expect(mayFetch(robots, "https://clinica.com.br/admin/secreto")).toBe(false);
  });

  it("reads an empty Disallow as 'nothing is disallowed'", () => {
    const robots = "User-agent: *\nDisallow:";
    expect(mayFetch(robots, "https://clinica.com.br/admin")).toBe(true);
  });

  it("prefers a group naming us over the * group", () => {
    const robots = "User-agent: *\nDisallow: /\n\nUser-agent: LeadBot\nDisallow: /admin";
    expect(mayFetch(robots, "https://clinica.com.br/contato")).toBe(true);
    expect(mayFetch(robots, "https://clinica.com.br/admin")).toBe(false);
  });

  it("applies one rule block to every agent the block names", () => {
    const robots = "User-agent: LeadBot\nUser-agent: Bingbot\nDisallow: /privado";
    expect(mayFetch(robots, "https://clinica.com.br/privado")).toBe(false);
  });

  it("ignores comments, blank lines and fields it does not understand", () => {
    const robots = [
      "# nosso robots",
      "Sitemap: https://clinica.com.br/sitemap.xml",
      "",
      "User-agent: *   # todo mundo",
      "Crawl-delay: 10",
      "Disallow: /wp-admin",
    ].join("\n");
    expect(mayFetch(robots, "https://clinica.com.br/wp-admin/x")).toBe(false);
    expect(mayFetch(robots, "https://clinica.com.br/")).toBe(true);
  });

  it("matches case-insensitively on the field names", () => {
    const robots = "USER-AGENT: *\nDISALLOW: /admin";
    expect(mayFetch(robots, "https://clinica.com.br/admin")).toBe(false);
  });
});
