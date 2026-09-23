import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { exchangeCode } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { takeIntendedRoute } from "../auth/intended-route";

/**
 * Where the Google sign-in round trip ends. The API redirects here with
 * `?code=…`, a short-lived, single-use exchange code (ticket 19). This page
 * clears the code from the URL, trades it for the JWT with
 * `POST /auth/exchange`, loads the user, and drops the visitor on the route
 * they originally wanted (or `/`).
 */
export function AuthCallbackPage() {
  const { reload } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  // A code is spent by its first redemption, so this must not run twice —
  // StrictMode invokes effects twice in development.
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;

    const code = new URLSearchParams(window.location.search).get("code");
    // Out of the address bar and history before anything else happens.
    window.history.replaceState(null, "", window.location.pathname);

    const fail = () => {
      setFailed(true);
      void navigate("/login", { replace: true });
    };

    if (!code) {
      fail();
      return;
    }

    exchangeCode(code).then(async () => {
      const destination = takeIntendedRoute();
      await reload();
      await navigate(destination, { replace: true });
    }, fail);
  }, [navigate, reload]);

  return <p data-testid="auth-callback">{failed ? "Signing in failed…" : "Signing you in…"}</p>;
}
