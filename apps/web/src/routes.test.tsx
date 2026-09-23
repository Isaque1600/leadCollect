import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberIntendedRoute } from "./auth/intended-route";
import { jsonResponse, renderApp, stubApi } from "./test/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("routing", () => {
  it("shows only the sign-in call to action on /login", async () => {
    stubApi();

    renderApp("/login");

    const link = await screen.findByTestId("google-login");
    expect(link).toHaveAttribute("href", expect.stringContaining("/auth/google"));
    expect(screen.queryByTestId("api-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-email")).not.toBeInTheDocument();
  });

  it("sends an anonymous visitor from a protected route to /login", async () => {
    stubApi();

    renderApp("/");

    await screen.findByTestId("google-login");
    expect(window.location.pathname).toBe("/login");
  });

  it("renders a 404 for an unknown route", async () => {
    stubApi();

    renderApp("/nope");

    expect(await screen.findByTestId("not-found")).toBeInTheDocument();
  });

  it("sends a signed-in visitor away from /login", async () => {
    localStorage.setItem("olc.token", "jwt-abc");
    stubApi();

    renderApp("/login");

    await screen.findByTestId("user-email");
    expect(window.location.pathname).toBe("/");
  });
});

/** Answers `POST /auth/exchange` the way the API does for a valid code. */
function redeemsTo(token: string) {
  return (url: string) => (url.endsWith("/auth/exchange") ? jsonResponse({ token }) : undefined);
}

describe("/auth/callback", () => {
  it("redeems the exchange code for the JWT, stores it, and clears the code from the URL", async () => {
    let urlWhileRedeeming = "";
    const fetchMock = stubApi({
      onFetch: (url) => {
        if (!url.endsWith("/auth/exchange")) return undefined;
        urlWhileRedeeming = window.location.href;
        return jsonResponse({ token: "jwt-abc" });
      },
    });

    renderApp("/auth/callback?code=code-123");

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent("hunter@example.com"),
    );
    const exchangeCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/auth/exchange"),
    );
    expect(exchangeCall?.[1]?.method).toBe("POST");
    expect(JSON.parse(exchangeCall?.[1]?.body as string)).toEqual({ code: "code-123" });
    expect(localStorage.getItem("olc.token")).toBe("jwt-abc");
    // The code is out of the address bar before the request even goes out.
    expect(urlWhileRedeeming).not.toContain("code-123");
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
  });

  it("returns the visitor to the route the guard remembered", async () => {
    // What `RequireAuth` stored when it bounced the deep link to /login.
    rememberIntendedRoute("/jobs/42?tab=leads");
    stubApi({ onFetch: redeemsTo("jwt-abc") });

    renderApp("/auth/callback?code=code-123");

    await waitFor(() => expect(window.location.pathname).toBe("/jobs/42"));
    expect(window.location.search).toBe("?tab=leads");
    expect(sessionStorage.getItem("olc.intendedRoute")).toBeNull();
  });

  it("falls back to /login when there is no exchange code in the URL", async () => {
    stubApi();

    renderApp("/auth/callback");

    await screen.findByTestId("google-login");
    expect(window.location.pathname).toBe("/login");
  });

  it("falls back to /login without a token when the API refuses the exchange code", async () => {
    stubApi({
      onFetch: (url) => (url.endsWith("/auth/exchange") ? jsonResponse({}, 401) : undefined),
    });

    renderApp("/auth/callback?code=spent-code");

    await screen.findByTestId("google-login");
    expect(window.location.pathname).toBe("/login");
    expect(window.location.search).toBe("");
    expect(localStorage.getItem("olc.token")).toBeNull();
  });

  it("sends the redeemed token as a bearer token on /me", async () => {
    const fetchMock = stubApi({ onFetch: redeemsTo("jwt-abc") });

    renderApp("/auth/callback?code=code-123");

    await screen.findByTestId("user-email");
    const meCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/me"));
    expect((meCall?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
  });
});
