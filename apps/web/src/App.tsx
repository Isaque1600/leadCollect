import { useEffect, useState } from "react";
import type { MeResponse } from "@olc/types";
import {
  captureTokenFromUrl,
  clearToken,
  getHealth,
  getMe,
  getToken,
  googleLoginUrl,
} from "./api";

type Status = "loading" | "ok" | "error";

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(res.status === "ok" ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    captureTokenFromUrl();
    if (!getToken()) return;
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Lead Collector</h1>
      <p>
        API:{" "}
        <strong data-testid="api-status">
          {status === "loading" ? "checking…" : status}
        </strong>
      </p>

      {user ? (
        <p>
          Signed in as <strong data-testid="user-email">{user.email}</strong>{" "}
          <button type="button" onClick={logout}>
            Log out
          </button>
        </p>
      ) : (
        <p>
          <a href={googleLoginUrl} data-testid="google-login">
            Sign in with Google
          </a>
        </p>
      )}
    </main>
  );
}
