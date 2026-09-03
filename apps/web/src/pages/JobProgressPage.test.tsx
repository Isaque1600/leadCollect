import type { JobProgressResponse } from "@olc/types";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobProgress } from "../jobs/test-fixtures";
import { JOB_POLL_INTERVAL_MS } from "../jobs/queries";
import { jsonResponse, renderApp, stubApi } from "../test/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  localStorage.setItem("olc.token", "jwt-abc");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Serves `GET /jobs/job-1` one payload per poll, repeating the last one. */
function stubJobPolls(polls: JobProgressResponse[]) {
  let index = 0;
  return stubApi({
    onFetch: (url) => {
      if (!url.endsWith("/jobs/job-1")) return undefined;
      const payload = polls[Math.min(index, polls.length - 1)]!;
      index += 1;
      return jsonResponse(payload);
    },
  });
}

/** Lets the poll interval elapse once. */
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(JOB_POLL_INTERVAL_MS + 100);
  });
}

describe("the Job progress view", () => {
  it("shows the progress bar and the running counts", async () => {
    stubJobPolls([
      jobProgress({
        status: "running",
        queriesTotal: 4,
        queriesDone: 1,
        leadsFound: 7,
        apiCallsUsed: 7,
        currentStep: "padaria em João Pessoa PB",
      }),
    ]);

    renderApp("/jobs/job-1");

    expect(await screen.findByTestId("job-status")).toHaveTextContent("running");
    const bar = screen.getByTestId("job-progress");
    expect(bar).toHaveAttribute("value", "1");
    expect(bar).toHaveAttribute("max", "4");
    expect(screen.getByTestId("job-queries")).toHaveTextContent("1 of 4 queries");
    expect(screen.getByTestId("job-leads-found")).toHaveTextContent("7");
    expect(screen.getByTestId("job-api-calls")).toHaveTextContent("7");
    expect(screen.getByTestId("job-step")).toHaveTextContent("padaria em João Pessoa PB");
  });

  it("polls until the Job is done, then stops and summarises", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = stubJobPolls([
      jobProgress({ status: "running", queriesTotal: 2, queriesDone: 1, leadsFound: 3 }),
      jobProgress({
        status: "done",
        queriesTotal: 2,
        queriesDone: 2,
        leadsFound: 12,
        apiCallsUsed: 12,
      }),
    ]);

    renderApp("/jobs/job-1");

    await waitFor(() => expect(screen.getByTestId("job-status")).toHaveTextContent("running"));
    await tick();
    await waitFor(() => expect(screen.getByTestId("job-status")).toHaveTextContent("done"));
    expect(screen.getByTestId("job-summary")).toHaveTextContent("collected 12 leads");

    const pollsSoFar = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/jobs/job-1"),
    ).length;
    await tick();
    await tick();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/jobs/job-1")).length).toBe(
      pollsSoFar,
    );
  });

  it("shows the Job's error text when it failed", async () => {
    stubJobPolls([jobProgress({ status: "failed", error: "Places API quota exhausted" })]);

    renderApp("/jobs/job-1");

    expect(await screen.findByTestId("job-error")).toHaveTextContent("Places API quota exhausted");
  });

  it("stops polling a cancelled Job and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = stubJobPolls([jobProgress({ status: "cancelled", leadsFound: 2 })]);

    renderApp("/jobs/job-1");

    await waitFor(() => expect(screen.getByTestId("job-summary")).toHaveTextContent("cancelled"));
    const pollsSoFar = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/jobs/job-1"),
    ).length;
    await tick();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/jobs/job-1")).length).toBe(
      pollsSoFar,
    );
  });

  it("surfaces a message when the Job is not the signed-in user's", async () => {
    stubApi({
      onFetch: (url) =>
        url.endsWith("/jobs/job-1")
          ? jsonResponse({ statusCode: 404, message: "job not found" }, 404)
          : undefined,
    });

    renderApp("/jobs/job-1");

    expect(await screen.findByTestId("job-error")).toHaveTextContent("job not found");
  });

  it("bounces to /login when polling comes back 401", async () => {
    stubApi({
      onFetch: (url) => (url.endsWith("/jobs/job-1") ? jsonResponse({}, 401) : undefined),
    });

    renderApp("/jobs/job-1");

    await screen.findByTestId("google-login");
    expect(localStorage.getItem("olc.token")).toBeNull();
  });
});
