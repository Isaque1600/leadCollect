const CALLBACK_PATH = "/auth/callback";

/**
 * The API still ends the sign-in round trip at `${WEB_APP_URL}/#token=…`, which
 * lands on the app root rather than on the callback route. Rewrite that to
 * `/auth/callback#token=…` before the router mounts, so the existing deployed
 * flow keeps working while `/auth/callback` stays the only place that reads a
 * token out of the URL.
 *
 * Ticket 19 moves the API to a `?code=…` redirect aimed straight at the
 * callback route; this shim can be deleted then.
 *
 * (`WEB_APP_URL` carries a trailing slash on both Render services, so the
 * redirect can arrive as `https://host//#token=…` — the pathname is rewritten
 * either way.)
 */
export function redirectLegacyTokenFragment(): void {
  if (window.location.pathname === CALLBACK_PATH) return;
  if (!/[#&]token=/.test(window.location.hash)) return;
  window.history.replaceState(null, "", CALLBACK_PATH + window.location.hash);
}
