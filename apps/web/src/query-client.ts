import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./api";

const MAX_RETRIES = 2;

/**
 * The one QueryClient the app runs on.
 *
 * It composes with the 401 pattern in `api.ts` rather than replacing it: every
 * query function still goes through `apiFetch`, which drops the token and
 * notifies `AuthProvider` before the promise rejects. All this configuration
 * has to do is *not* fight that — retrying an `UnauthorizedError` would fire
 * more doomed requests while the app is already on its way to `/login`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof UnauthorizedError) && failureCount < MAX_RETRIES,
        // Polling drives the freshness that matters here; refetching every time
        // the tab regains focus would only add requests nobody asked for.
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
