import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { UnauthorizedError } from "../api";
import { useStartJob } from "./queries";

/** The Places API refuses a `maxResultCount` above this, and so does the DTO. */
const MAX_RESULTS_CAP = 20;
const DEFAULT_MAX_RESULTS = 20;

/**
 * Starts a Job from a structured search (CONTEXT.md: Job, Source). On success it
 * hands the user straight to the progress view for the new Job — the API has
 * only queued it at that point, the work happens in-process afterwards.
 */
export function SearchForm() {
  const [businessType, setBusinessType] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [maxResults, setMaxResults] = useState(String(DEFAULT_MAX_RESULTS));
  const navigate = useNavigate();
  const startJob = useStartJob();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startJob.mutate(
      {
        businessType: businessType.trim(),
        city: city.trim(),
        state: state.trim(),
        maxResults: Number(maxResults),
      },
      {
        onSuccess: (job) => void navigate(`/jobs/${job.id}`),
      },
    );
  }

  // A 401 has already cleared the token and set the app anonymous, so
  // `RequireAuth` is mid-redirect to `/login` — saying "unauthorized" here
  // would just flash a message nobody can act on.
  const failure =
    startJob.error && !(startJob.error instanceof UnauthorizedError) ? startJob.error : null;

  return (
    <form onSubmit={onSubmit} data-testid="search-form">
      <h2>New search</h2>

      <p>
        <label htmlFor="businessType">Business type</label>
        <input
          id="businessType"
          name="businessType"
          required
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
        />
      </p>
      <p>
        <label htmlFor="city">City</label>
        <input
          id="city"
          name="city"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </p>
      <p>
        <label htmlFor="state">State</label>
        <input
          id="state"
          name="state"
          required
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </p>
      <p>
        <label htmlFor="maxResults">Max results per source</label>
        <input
          id="maxResults"
          name="maxResults"
          type="number"
          min={1}
          max={MAX_RESULTS_CAP}
          required
          value={maxResults}
          onChange={(e) => setMaxResults(e.target.value)}
        />
      </p>

      <button type="submit" disabled={startJob.isPending}>
        {startJob.isPending ? "Starting…" : "Start search"}
      </button>

      {failure ? (
        <p role="alert" data-testid="search-error">
          {failure.message}
        </p>
      ) : null}
    </form>
  );
}
