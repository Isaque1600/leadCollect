import { describe, expect, it } from "vitest";
import {
  isNeverEnriched,
  isStale,
  STALE_AFTER_DAYS,
} from "../../../../src/modules/enrichment/domain/staleness";

const now = new Date("2026-03-01T12:00:00Z");

/** `now` minus the given number of days, to the millisecond. */
function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("isNeverEnriched", () => {
  it("is true only for a Lead with no Enrichment at all", () => {
    expect(isNeverEnriched(null)).toBe(true);
    expect(isNeverEnriched(daysAgo(365))).toBe(false);
  });
});

describe("isStale", () => {
  it("treats an Enrichment from today as fresh", () => {
    expect(isStale(daysAgo(0), now)).toBe(false);
  });

  it("treats an Enrichment from the day before the boundary as fresh", () => {
    expect(isStale(daysAgo(STALE_AFTER_DAYS - 1), now)).toBe(false);
  });

  // "More than 30 days old" — exactly 30 days is the last fresh moment, and a
  // single millisecond past it is where a Stale Lead begins.
  it("treats an Enrichment exactly 30 days old as fresh", () => {
    expect(isStale(daysAgo(STALE_AFTER_DAYS), now)).toBe(false);
  });

  it("treats one millisecond past 30 days as stale", () => {
    expect(isStale(new Date(daysAgo(STALE_AFTER_DAYS).getTime() - 1), now)).toBe(true);
  });

  it("treats a much older Enrichment as stale", () => {
    expect(isStale(daysAgo(365), now)).toBe(true);
  });

  it("does not call a never-enriched Lead stale — that is a different case", () => {
    expect(isStale(null, now)).toBe(false);
  });
});
