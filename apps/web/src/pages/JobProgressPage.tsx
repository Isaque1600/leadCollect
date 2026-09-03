import type { JobProgressResponse } from "@olc/types";
import { Link, useParams } from "react-router";
import { UnauthorizedError } from "../api";
import { isTerminal } from "../jobs/job-status";
import { useJobProgress } from "../jobs/queries";

/** What the Job ended up as, in one line. Only rendered in a terminal state. */
function Summary({ job }: { job: JobProgressResponse }) {
  if (job.status === "failed") {
    return (
      <p role="alert" data-testid="job-error">
        {job.error ?? "The search failed."}
      </p>
    );
  }
  if (job.status === "cancelled") {
    return <p data-testid="job-summary">Search cancelled after {job.leadsFound} leads.</p>;
  }
  return (
    <p data-testid="job-summary">
      Done — collected {job.leadsFound} {job.leadsFound === 1 ? "lead" : "leads"}.
    </p>
  );
}

/**
 * The progress view for one Job, reached straight after the search form starts
 * it. It polls `GET /jobs/:id` every couple of seconds (ADR-0003: the API runs
 * the Job in-process and writes progress onto the row, the SPA polls) and stops
 * as soon as the Job is `done`, `failed` or `cancelled`.
 *
 * It is a real route so a refresh — likely, since a Job can run for minutes —
 * lands back on the same Job.
 */
export function JobProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, error, isPending } = useJobProgress(jobId ?? "");

  if (isPending) return <p data-testid="job-loading">Loading the search…</p>;

  if (error) {
    // A 401 is already taking the user to `/login`; anything else is worth
    // showing (a 404 for someone else's Job, a network failure, a 500).
    if (error instanceof UnauthorizedError) return null;
    return (
      <p role="alert" data-testid="job-error">
        {error.message}
      </p>
    );
  }

  const finished = isTerminal(job.status);

  return (
    <section>
      <h2>Search progress</h2>
      <p>
        Status: <strong data-testid="job-status">{job.status}</strong>
      </p>

      <progress
        data-testid="job-progress"
        value={job.queriesDone}
        max={Math.max(job.queriesTotal, 1)}
      />
      <p data-testid="job-queries">
        {job.queriesDone} of {job.queriesTotal} queries
      </p>

      {job.currentStep && !finished ? <p data-testid="job-step">{job.currentStep}</p> : null}

      <ul>
        <li>
          Leads found: <strong data-testid="job-leads-found">{job.leadsFound}</strong>
        </li>
        <li>
          API calls used: <strong data-testid="job-api-calls">{job.apiCallsUsed}</strong>
        </li>
      </ul>

      {finished ? <Summary job={job} /> : null}

      <p>
        <Link to="/">Start another search</Link>
      </p>
    </section>
  );
}
