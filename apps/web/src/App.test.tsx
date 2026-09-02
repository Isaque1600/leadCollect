import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
});
