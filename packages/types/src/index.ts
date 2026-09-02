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
