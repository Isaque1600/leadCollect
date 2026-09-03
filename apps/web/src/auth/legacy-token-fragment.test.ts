import { beforeEach, describe, expect, it } from "vitest";
import { redirectLegacyTokenFragment } from "./legacy-token-fragment";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("redirectLegacyTokenFragment", () => {
  it("moves a token fragment that landed on the root to /auth/callback", () => {
    window.history.replaceState(null, "", "/#token=jwt-abc");

    redirectLegacyTokenFragment();

    expect(window.location.pathname).toBe("/auth/callback");
    expect(window.location.hash).toBe("#token=jwt-abc");
  });

  it("leaves the URL alone when there is no token fragment", () => {
    window.history.replaceState(null, "", "/login");

    redirectLegacyTokenFragment();

    expect(window.location.pathname).toBe("/login");
  });

  it("leaves the callback route alone", () => {
    window.history.replaceState(null, "", "/auth/callback#token=jwt-abc");

    redirectLegacyTokenFragment();

    expect(window.location.pathname).toBe("/auth/callback");
    expect(window.location.hash).toBe("#token=jwt-abc");
  });
});
