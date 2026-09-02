import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { captureTokenFromUrl } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { takeIntendedRoute } from "../auth/intended-route";

/**
 * Where the Google sign-in round trip ends. Captures the token the API sent
 * back, loads the user, and drops the visitor on the route they originally
 * wanted (or `/`).
 *
 * Ticket 19 replaces the URL-fragment handoff with a POST code exchange; this
 * is the route that exchange will live on.
 */
export function AuthCallbackPage() {
  const { reload } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  // Capturing consumes the fragment, so this must not run twice — StrictMode
  // invokes effects twice in development.
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;

    if (!captureTokenFromUrl()) {
      setFailed(true);
      void navigate("/login", { replace: true });
      return;
    }

    const destination = takeIntendedRoute();
    void reload().then(() => navigate(destination, { replace: true }));
  }, [navigate, reload]);

  return <p data-testid="auth-callback">{failed ? "Signing in failed…" : "Signing you in…"}</p>;
}
