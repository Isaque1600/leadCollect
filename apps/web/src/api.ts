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

/** Thrown by every API call that comes back 401. */
export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registers the single place that reacts to a 401 from any API call. The token
 * is already cleared by the time the handler runs, so the handler only has to
 * move the UI back to signed-out. Returns an unsubscribe function.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

/** URL that starts the Google sign-in round trip. */
export const googleLoginUrl = `${API_URL}/auth/google`;

/**
 * Every API call goes through here so a 401 is handled in one place: the token
 * is dropped and the registered handler is told about it.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    unauthorizedHandler?.();
    throw new UnauthorizedError();
  }
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);

  return (await res.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

/** Fetches the signed-in user. Throws `UnauthorizedError` on a 401. */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me");
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
