import type { JobStatus } from "@olc/types";

const TERMINAL: readonly JobStatus[] = ["done", "failed", "cancelled"];

/** A Job in one of these states will never change again, so polling can stop. */
export function isTerminal(status: JobStatus | undefined): boolean {
  return status !== undefined && TERMINAL.includes(status);
}
