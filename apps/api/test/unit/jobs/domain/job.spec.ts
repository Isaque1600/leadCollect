import { describe, expect, it } from "vitest";
import { composeQueries, isTerminal } from "../../../../src/modules/jobs/domain/job";
import { jobParams } from "../fake-jobs";

describe("composeQueries", () => {
  it("composes '{businessType} em {city} {state}'", () => {
    expect(composeQueries(jobParams)).toEqual([
      { text: "Clínicas odontológicas em Patos PB", businessType: "Clínicas odontológicas" },
    ]);
  });

  it("trims whatever the user typed so the query has no stray spacing", () => {
    const [query] = composeQueries({
      ...jobParams,
      businessType: "  Padarias  ",
      city: " João Pessoa ",
      state: " PB ",
    });

    expect(query!.text).toBe("Padarias em João Pessoa PB");
    expect(query!.businessType).toBe("Padarias");
  });

  it("drops the location clause entirely when city and state are blank", () => {
    const [query] = composeQueries({ ...jobParams, city: "", state: "" });

    expect(query!.text).toBe("Clínicas odontológicas");
  });

  it("returns one query per Job for now, so queriesTotal is 1", () => {
    expect(composeQueries(jobParams)).toHaveLength(1);
  });
});

describe("isTerminal", () => {
  it("stops the SPA polling on done, failed, and cancelled", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("keeps polling while queued or running", () => {
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("running")).toBe(false);
  });
});
