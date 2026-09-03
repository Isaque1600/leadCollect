import type {
  HealthResponse,
  JobProgressResponse,
  MeResponse,
  StartJobRequest,
  StartJobResponse,
} from "@olc/types";

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

/**
 * Any non-2xx that is not a 401. Carries the API's own message when it sent
 * one, so a screen can show something better than a status code — Nest's
 * exception filter answers `{ statusCode, message, error }` and `message` is a
 * string for most errors, an array for a failed `ValidationPipe`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type NestErrorBody = { message?: string | string[] };

async function readErrorMessage(res: Response, path: string): Promise<string> {
  try {
    const body = (await res.json()) as NestErrorBody;
    const { message } = body;
    if (Array.isArray(message) && message.length > 0) return message.join(", ");
    if (typeof message === "string" && message.length > 0) return message;
  } catch {
    // Not JSON, or no body at all — fall through to the generic message.
  }
  return `${path} failed: ${res.status}`;
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
  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res, path));

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
 * Starts a Job. Answers as soon as the `queued` row exists — the work runs
 * in-process on the API (ADR-0003), so the caller navigates to the progress
 * view and polls from there.
 */
export function startJob(body: StartJobRequest): Promise<StartJobResponse> {
  return apiFetch<StartJobResponse>("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** One poll of a Job's progress. A Job that is not the caller's comes back 404. */
export function getJobProgress(jobId: string): Promise<JobProgressResponse> {
  return apiFetch<JobProgressResponse>(`/jobs/${encodeURIComponent(jobId)}`);
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
