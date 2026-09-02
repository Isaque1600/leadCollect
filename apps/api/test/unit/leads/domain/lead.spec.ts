import { describe, expect, it } from "vitest";
import { sanitizeWebsiteUrl } from "../../../../src/modules/leads/domain/lead";

describe("sanitizeWebsiteUrl", () => {
  it("drops the query string and the fragment", () => {
    expect(sanitizeWebsiteUrl("https://exemplo.com.br/contato?utm_source=maps#topo")).toBe(
      "https://exemplo.com.br/contato",
    );
  });

  it("keeps a clean URL as it is", () => {
    expect(sanitizeWebsiteUrl("https://exemplo.com.br/")).toBe("https://exemplo.com.br/");
  });

  it("treats an absent website as null rather than an empty string", () => {
    expect(sanitizeWebsiteUrl(undefined)).toBeNull();
    expect(sanitizeWebsiteUrl("")).toBeNull();
  });

  it("returns anything that is not an http(s) URL untouched", () => {
    expect(sanitizeWebsiteUrl("mailto:contato@exemplo.com.br")).toBe(
      "mailto:contato@exemplo.com.br",
    );
    expect(sanitizeWebsiteUrl("nao é uma url")).toBe("nao é uma url");
  });
});
