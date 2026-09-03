const INTENDED_ROUTE_KEY = "olc.intendedRoute";

/**
 * Where the user was headed before the guard bounced them to `/login`.
 *
 * This has to survive a full page navigation (the sign-in round trip leaves the
 * SPA for Google and comes back), so router state is not enough — sessionStorage
 * is, and it dies with the tab.
 */
export function rememberIntendedRoute(route: string): void {
  sessionStorage.setItem(INTENDED_ROUTE_KEY, route);
}

/** Reads and forgets the remembered route. Falls back to `/`. */
export function takeIntendedRoute(): string {
  const route = sessionStorage.getItem(INTENDED_ROUTE_KEY);
  sessionStorage.removeItem(INTENDED_ROUTE_KEY);
  if (!route || !route.startsWith("/") || route.startsWith("//")) return "/";
  return route;
}

export function forgetIntendedRoute(): void {
  sessionStorage.removeItem(INTENDED_ROUTE_KEY);
}
