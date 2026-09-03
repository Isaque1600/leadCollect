import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberIntendedRoute } from "./auth/intended-route";
import { renderApp, stubApi } from "./test/render-app";

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

describe("/auth/callback", () => {
  it("captures the token, loads the user, and lands on the home route", async () => {
    stubApi();

    renderApp("/auth/callback#token=jwt-abc");

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent("hunter@example.com"),
    );
    expect(localStorage.getItem("olc.token")).toBe("jwt-abc");
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
  });

  it("returns the visitor to the route the guard remembered", async () => {
    // What `RequireAuth` stored when it bounced the deep link to /login.
    rememberIntendedRoute("/jobs/42?tab=leads");
    stubApi();

    renderApp("/auth/callback#token=jwt-abc");

    await waitFor(() => expect(window.location.pathname).toBe("/jobs/42"));
    expect(window.location.search).toBe("?tab=leads");
    expect(sessionStorage.getItem("olc.intendedRoute")).toBeNull();
  });

  it("falls back to /login when there is no token in the URL", async () => {
    stubApi();

    renderApp("/auth/callback");

    await screen.findByTestId("google-login");
    expect(window.location.pathname).toBe("/login");
  });

  it("sends the captured token as a bearer token on /me", async () => {
    const fetchMock = stubApi();

    renderApp("/auth/callback#token=jwt-abc");

    await screen.findByTestId("user-email");
    const meCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/me"));
    expect((meCall?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
  });
});
