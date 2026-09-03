import type { JobProgressResponse, StartJobRequest, StartJobResponse } from "@olc/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getJobProgress, startJob } from "../api";
import { isTerminal } from "./job-status";

/** How often the progress view asks the API where the Job has got to. */
export const JOB_POLL_INTERVAL_MS = 2000;

export const jobQueryKey = (jobId: string) => ["job", jobId] as const;

/** Starts a Job. The caller navigates to `/jobs/:jobId` with the id it returns. */
export function useStartJob() {
  return useMutation<StartJobResponse, Error, StartJobRequest>({
    mutationFn: startJob,
  });
}

/**
 * Polls `GET /jobs/:id` until the Job reaches a terminal state, then stops.
 * `refetchInterval` is read again after every response, so the poll switches
 * itself off the moment `done`/`failed`/`cancelled` comes back — there is no
 * timer to clear on unmount either, TanStack Query owns it.
 */
export function useJobProgress(jobId: string) {
  return useQuery<JobProgressResponse>({
    queryKey: jobQueryKey(jobId),
    queryFn: () => getJobProgress(jobId),
    refetchInterval: ({ state }) => (isTerminal(state.data?.status) ? false : JOB_POLL_INTERVAL_MS),
    // A Job that is still running is stale as soon as it is read.
    staleTime: 0,
  });
}
