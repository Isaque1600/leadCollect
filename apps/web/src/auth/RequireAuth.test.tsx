import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { RequireAuth } from "./RequireAuth";
import { stubApi } from "../test/render-app";

/** A route table with a protected deep link, standing in for ticket 04's. */
function renderGuarded(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p data-testid="login">login</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/jobs/:jobId" element={<p data-testid="job">job</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RequireAuth", () => {
  it("redirects an anonymous visitor to /login and remembers where they wanted to go", async () => {
    stubApi();

    renderGuarded("/jobs/42?tab=leads");

    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(sessionStorage.getItem("olc.intendedRoute")).toBe("/jobs/42?tab=leads");
  });

  it("renders the protected route for a signed-in visitor", async () => {
    localStorage.setItem("olc.token", "jwt-abc");
    stubApi();

    renderGuarded("/jobs/42");

    expect(await screen.findByTestId("job")).toBeInTheDocument();
    expect(sessionStorage.getItem("olc.intendedRoute")).toBeNull();
  });

  it("sends the visitor back to /login when the token is rejected", async () => {
    localStorage.setItem("olc.token", "stale");
    stubApi({ me: 401 });

    renderGuarded("/jobs/42");

    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(localStorage.getItem("olc.token")).toBeNull();
  });
});
