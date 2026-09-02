import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("shows ok when the API health check succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      }),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByTestId("api-status")).toHaveTextContent("ok"));
  });

  it("shows error when the API health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    render(<App />);
    await waitFor(() => expect(screen.getByTestId("api-status")).toHaveTextContent("error"));
  });

  it("shows a Sign in with Google link when there is no token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }),
    );

    render(<App />);
    const link = await screen.findByTestId("google-login");
    expect(link).toHaveAttribute("href", expect.stringContaining("/auth/google"));
  });

  it("captures a token from the URL fragment, calls /me, and shows the email", async () => {
    window.history.replaceState(null, "", "/#token=jwt-abc");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (String(url).endsWith("/health")) {
          return Promise.resolve({ ok: true, json: async () => ({ status: "ok" }) });
        }
        expect((opts?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: "u1",
            email: "hunter@example.com",
            name: "Hunter",
            monthlyQuotaUsed: 0,
          }),
        });
      }),
    );

    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent("hunter@example.com"),
    );
    expect(localStorage.getItem("olc.token")).toBe("jwt-abc");
    expect(window.location.hash).toBe("");
  });

  it("clears the token and returns to signed-out on a 401 from /me", async () => {
    localStorage.setItem("olc.token", "stale");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).endsWith("/health")) {
          return Promise.resolve({ ok: true, json: async () => ({ status: "ok" }) });
        }
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      }),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByTestId("google-login")).toBeInTheDocument());
    expect(localStorage.getItem("olc.token")).toBeNull();
  });
});
