import type { HealthResponse } from "@olc/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`health check failed: ${res.status}`);
  return (await res.json()) as HealthResponse;
}
