import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderApp, stubApi } from "../test/render-app";
import { jobProgress } from "./test-fixtures";

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

function fillSearch() {
  fireEvent.change(screen.getByLabelText(/business type/i), { target: { value: " padaria " } });
  fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: "João Pessoa" } });
  fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: "PB" } });
  fireEvent.change(screen.getByLabelText(/max results per source/i), { target: { value: "10" } });
}

describe("the search form", () => {
  it("posts the structured search and lands on the progress view", async () => {
    const fetchMock = stubApi({
      onFetch: (url, init) => {
        if (url.endsWith("/jobs") && init?.method === "POST") {
          return jsonResponse({ id: "job-1", status: "queued" });
        }
        if (url.endsWith("/jobs/job-1")) return jsonResponse(jobProgress({ id: "job-1" }));
        return undefined;
      },
    });

    renderApp("/");
    await screen.findByTestId("search-form");
    fillSearch();
    fireEvent.click(screen.getByRole("button", { name: /start search/i }));

    expect(await screen.findByTestId("job-status")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/jobs/job-1");

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST");
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({
      businessType: "padaria",
      city: "João Pessoa",
      state: "PB",
      maxResults: 10,
    });
  });

  it("shows the API's message when starting the Job fails", async () => {
    stubApi({
      onFetch: (url, init) =>
        url.endsWith("/jobs") && init?.method === "POST"
          ? jsonResponse(
              { statusCode: 400, message: ["maxResults must not be greater than 20"] },
              400,
            )
          : undefined,
    });

    renderApp("/");
    await screen.findByTestId("search-form");
    fillSearch();
    fireEvent.click(screen.getByRole("button", { name: /start search/i }));

    expect(await screen.findByTestId("search-error")).toHaveTextContent(
      "maxResults must not be greater than 20",
    );
    expect(window.location.pathname).toBe("/");
  });

  it("bounces to /login when starting the Job comes back 401", async () => {
    stubApi({
      onFetch: (url, init) =>
        url.endsWith("/jobs") && init?.method === "POST" ? jsonResponse({}, 401) : undefined,
    });

    renderApp("/");
    await screen.findByTestId("search-form");
    fillSearch();
    fireEvent.click(screen.getByRole("button", { name: /start search/i }));

    await screen.findByTestId("google-login");
    expect(localStorage.getItem("olc.token")).toBeNull();
    expect(screen.queryByTestId("search-error")).not.toBeInTheDocument();
  });
});
