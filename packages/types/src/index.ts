/**
 * Shared types between the API and the web SPA.
 * Domain types (Lead, Job, ...) land here as tickets 02+ add them.
 */

export interface HealthResponse {
  status: "ok";
}

/**
 * The authenticated user as returned by `GET /me`.
 * `monthlyQuotaUsed` is the count of Billable Calls the user has spent this
 * month (see CONTEXT.md: Quota).
 */
export interface MeResponse {
  id: string;
  email: string;
  name: string;
  monthlyQuotaUsed: number;
}

/**
 * Claims carried by the signed JWT the API issues after a successful Google
 * sign-in. `sub` is the `users` row id.
 */
export interface AuthTokenClaims {
  sub: string;
  email: string;
}

/**
 * The redirect the API sends the browser to after the Google round trip is
 * `${WEB_APP_URL}/#token=<jwt>`. The SPA reads the `token` from the URL
 * fragment, stores it in localStorage, and clears the fragment.
 */
export interface AuthCallbackParams {
  token: string;
}

/**
 * Where a Lead came from (CONTEXT.md: Source). The Portuguese labels are the
 * `fonte` value kept in exports, so they are the stored value too.
 */
export type SourceLabel = "Google Maps" | "Busca Web";

/**
 * A Job's lifecycle. `cancelled` is reachable only once ticket 09 adds the
 * cancel endpoint; it is part of the contract from the start so the SPA can
 * treat it as terminal.
 */
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** The structured search a Job is started with — the body of `POST /jobs`. */
export interface StartJobRequest {
  businessType: string;
  city: string;
  /** Brazilian state, usually the two-letter UF (e.g. "PB"). */
  state: string;
  /** How many results to ask each Source for. The Places API caps this at 20. */
  maxResults: number;
}

/** What `POST /jobs` answers with: enough to navigate to the progress view. */
export interface StartJobResponse {
  id: string;
  status: JobStatus;
}

/**
 * What `GET /jobs/:id` answers with — the payload the SPA polls (ADR-0003:
 * progress lives on the `jobs` row, the frontend polls, there is no queue).
 *
 * `apiCallsUsed` counts Billable Calls (CONTEXT.md), i.e. Places details
 * requests; the text search itself is not billed per Lead.
 */
export interface JobProgressResponse {
  id: string;
  status: JobStatus;
  queriesTotal: number;
  queriesDone: number;
  leadsFound: number;
  apiCallsUsed: number;
  currentStep: string | null;
  error: string | null;
}
