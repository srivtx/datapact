import { describe, expect, test } from "bun:test";
import { toSarif } from "../src/sarif.ts";
import type { ValidationResult } from "../src/types.ts";

const result: ValidationResult = {
  contract: "orders",
  dataset: "data.csv",
  rows: 1,
  issues: [
    { code: "DP-203", severity: "error", location: "orders.amount", message: "bad value" },
    { code: "DP-107", severity: "warning", location: "orders.phone", message: "unknown format" },
    { code: "DP-109", severity: "info", location: "contract", message: "no name" },
  ],
  counts: { error: 1, warning: 1, info: 1 },
};

describe("toSarif", () => {
  test("emits a SARIF 2.1.0 log with the caller's tool name", () => {
    const log = toSarif(result, "datapact", "0.1.0");
    expect(log.version).toBe("2.1.0");
    expect(log.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    const run = log.runs[0];
    expect(run?.tool.driver.name).toBe("datapact");
    expect(run?.tool.driver.version).toBe("0.1.0");
    expect(run?.tool.driver.informationUri).toBe("https://srivtx.github.io/datapact");
    expect(run?.tool.driver.rules.map((rule) => rule.id)).toEqual(["DP-107", "DP-109", "DP-203"]);
  });

  test("maps severities to SARIF levels and tags", () => {
    const run = toSarif(result, "datapact", "0.1.0").runs[0];
    const results = run?.results ?? [];
    expect(results[0]?.level).toBe("error");
    expect(results[0]?.properties.tags).toEqual(["error"]);
    expect(results[1]?.level).toBe("warning");
    expect(results[2]?.level).toBe("note");
    expect(results[0]?.ruleId).toBe("DP-203");
    expect(results[0]?.locations[0]?.physicalLocation.artifactLocation.uri).toBe("orders.amount");
  });

  test("accepts an array of results", () => {
    const log = toSarif([result, result], "datapact", "0.1.0");
    expect(log.runs[0]?.results).toHaveLength(6);
  });
});
