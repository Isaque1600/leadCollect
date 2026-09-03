import type { JobProgressResponse } from "@olc/types";

/** A `GET /jobs/:id` payload with everything zeroed, overridable per test. */
export function jobProgress(overrides: Partial<JobProgressResponse> = {}): JobProgressResponse {
  return {
    id: "job-1",
    status: "queued",
    queriesTotal: 1,
    queriesDone: 0,
    leadsFound: 0,
    apiCallsUsed: 0,
    currentStep: null,
    error: null,
    ...overrides,
  };
}
