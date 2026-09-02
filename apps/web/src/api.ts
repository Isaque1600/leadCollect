import type { HealthResponse, MeResponse } from "@olc/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const TOKEN_KEY = "olc.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** URL that starts the Google sign-in round trip. */
export const googleLoginUrl = `${API_URL}/auth/google`;

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`health check failed: ${res.status}`);
  return (await res.json()) as HealthResponse;
}

/** Fetches the signed-in user. Throws `"unauthorized"` on a 401. */
export async function getMe(): Promise<MeResponse> {
  const token = getToken();
  const res = await fetch(`${API_URL}/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`/me failed: ${res.status}`);
  return (await res.json()) as MeResponse;
}

/**
 * If the API bounced us back with `#token=...`, store it and strip the
 * fragment. Returns true when a token was captured.
 */
export function captureTokenFromUrl(): boolean {
  const hash = window.location.hash;
  const match = /[#&]token=([^&]+)/.exec(hash);
  if (!match) return false;
  setToken(decodeURIComponent(match[1]!));
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}
