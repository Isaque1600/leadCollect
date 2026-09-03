import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "../auth/AuthProvider";
import { AppRoutes } from "../routes";

/**
 * The real client's retry policy would make every failing-call test wait out
 * two backoffs, so tests get their own client with retries off. Everything else
 * — the provider placement, the query keys, the polling — is the real thing.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders the whole app at `url`, through the real router, query client and
 * auth provider, so tests exercise routes the way a browser reaches them.
 */
export function renderApp(url = "/") {
  window.history.replaceState(null, "", url);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

const me = {
  id: "u1",
  email: "hunter@example.com",
  name: "Hunter",
  monthlyQuotaUsed: 0,
};

/** A `fetch` response stand-in carrying `body` as JSON. */
export function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Answers a call the way `apiFetch` expects, or returns undefined to pass. */
type FetchHandler = (url: string, init?: RequestInit) => unknown;

type StubOptions = {
  health?: "ok" | 401;
  me?: "ok" | 401;
  /** Handles the endpoints a given test cares about; `/health` and `/me` below. */
  onFetch?: FetchHandler;
};

/** Stubs `fetch` for the two endpoints the shell and home page always call. */
export function stubApi({ health = "ok", me: meStatus = "ok", onFetch }: StubOptions = {}) {
  const unauthorized = jsonResponse({}, 401);
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const handled = onFetch?.(String(url), init);
    if (handled !== undefined) return Promise.resolve(handled);

    if (String(url).endsWith("/health")) {
      return Promise.resolve(health === "ok" ? jsonResponse({ status: "ok" }) : unauthorized);
    }
    return Promise.resolve(meStatus === "ok" ? jsonResponse(me) : unauthorized);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export { me as signedInUser };
