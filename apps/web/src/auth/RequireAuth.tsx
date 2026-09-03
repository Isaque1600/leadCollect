import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import { rememberIntendedRoute } from "./intended-route";

/**
 * Guards every route nested under it: anonymous visitors go to `/login` and the
 * URL they asked for is remembered so the callback can put them back on it.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <p>Loading…</p>;

  if (status === "anonymous") {
    rememberIntendedRoute(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
