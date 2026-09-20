import { describe, expect, test } from "bun:test";
import { formatJson, formatText } from "../src/report.ts";
import type { ValidationResult } from "../src/types.ts";

const result: ValidationResult = {
  contract: "orders",
  dataset: "data.csv",
  rows: 2,
  issues: [
    {
      code: "DP-203",
      severity: "error",
      location: "orders.amount",
      message: "row 1: \"abc\" is not a valid number",
    },
    {
      code: "DP-109",
      severity: "info",
      location: "contract",
      message: "the contract has no name",
    },
  ],
  counts: { error: 1, warning: 0, info: 1 },
};

describe("report", () => {
  test("formatText renders the header and one line per issue", () => {
    const lines = formatText(result).split("\n");
    expect(lines[0]).toBe("data.csv  rows:2  errors:1  warnings:0  info:1");
    expect(lines[1]).toBe('ERROR  DP-203  orders.amount  row 1: "abc" is not a valid number');
    expect(lines[2]).toBe("INFO  DP-109  contract  the contract has no name");
    expect(lines).toHaveLength(3);
  });

  test("formatText falls back to a dash for an empty location", () => {
    const text = formatText({
      ...result,
      issues: [{ code: "DP-PARSE-000", severity: "error", location: "", message: "bad" }],
      counts: { error: 1, warning: 0, info: 0 },
    });
    expect(text.split("\n")[1]).toBe("ERROR  DP-PARSE-000  -  bad");
  });

  test("formatJson round-trips the result", () => {
    expect(JSON.parse(formatJson(result))).toEqual(result);
  });
});
