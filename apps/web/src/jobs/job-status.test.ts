import { describe, expect, it } from "vitest";
import { isTerminal } from "./job-status";

describe("isTerminal", () => {
  it("is true for the states a Job never leaves", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("is false while the Job can still move", () => {
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("running")).toBe(false);
  });

  it("is false before the first poll has answered", () => {
    expect(isTerminal(undefined)).toBe(false);
  });
});
