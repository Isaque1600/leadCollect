import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "../auth/AuthProvider";
import { AppRoutes } from "../routes";

/**
 * Renders the whole app at `url`, through the real router and auth provider,
 * so tests exercise routes the way a browser reaches them.
 */
export function renderApp(url = "/") {
  window.history.replaceState(null, "", url);
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>,
  );
}

const me = {
  id: "u1",
  email: "hunter@example.com",
  name: "Hunter",
  monthlyQuotaUsed: 0,
};

type StubOptions = { health?: "ok" | 401; me?: "ok" | 401 };

/** Stubs `fetch` for the two endpoints the shell and home page call. */
export function stubApi({ health = "ok", me: meStatus = "ok" }: StubOptions = {}) {
  const unauthorized = { ok: false, status: 401, json: async () => ({}) };
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).endsWith("/health")) {
      return Promise.resolve(
        health === "ok"
          ? { ok: true, status: 200, json: async () => ({ status: "ok" }) }
          : unauthorized,
      );
    }
    return Promise.resolve(
      meStatus === "ok" ? { ok: true, status: 200, json: async () => me } : unauthorized,
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export { me as signedInUser };
