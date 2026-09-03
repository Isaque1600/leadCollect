import { fireEvent, screen, waitFor } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, stubApi } from "./test/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  localStorage.setItem("olc.token", "jwt-abc");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("app shell", () => {
  it("shows the signed-in email once, in the shell", async () => {
    stubApi();

    renderApp("/");

    expect(await screen.findByTestId("user-email")).toHaveTextContent("hunter@example.com");
  });

  it("shows ok when the API health check succeeds", async () => {
    stubApi();

    renderApp("/");

    await waitFor(() => expect(screen.getByTestId("api-status")).toHaveTextContent("ok"));
  });

  it("shows error when the API health check fails", async () => {
    stubApi();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith("/health")) return Promise.reject(new Error("boom"));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: "u1",
          email: "hunter@example.com",
          name: "H",
          monthlyQuotaUsed: 0,
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/");

    await waitFor(() => expect(screen.getByTestId("api-status")).toHaveTextContent("error"));
  });

  it("clears the token and returns to /login on log out", async () => {
    stubApi();

    renderApp("/");
    await screen.findByTestId("user-email");
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await screen.findByTestId("google-login");
    expect(localStorage.getItem("olc.token")).toBeNull();
    expect(window.location.pathname).toBe("/login");
  });

  it("bounces to /login when any API call comes back 401", async () => {
    // /me succeeds, then the health call 401s — the handling lives in `api.ts`,
    // not at the call site.
    stubApi({ health: 401 });

    renderApp("/");

    await screen.findByTestId("google-login");
    expect(localStorage.getItem("olc.token")).toBeNull();
    expect(window.location.pathname).toBe("/login");
  });
});
