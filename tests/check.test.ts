import { describe, expect, test } from "bun:test";
import { check, countIssues, lintOnly } from "../src/check.ts";
import { PARSE_ERROR_CODE } from "../src/types.ts";

const CONTRACT = `
name: orders
schema:
  - name: orders
    logicalType: object
    properties:
      - name: id
        logicalType: integer
        required: true
      - name: amount
        logicalType: number
        minimum: 0
`;

describe("check", () => {
  test("parses, lints and validates, returning counts and rows", () => {
    const result = check(CONTRACT, "id,amount\n1,5\n2,-1\n", {
      contractName: "orders",
      datasetName: "data.csv",
    });
    expect(result.contract).toBe("orders");
    expect(result.dataset).toBe("data.csv");
    expect(result.rows).toBe(2);
    expect(result.counts.error).toBeGreaterThanOrEqual(1);
    expect(result.issues.some((issue) => issue.code === "DP-206")).toBe(true);
  });

  test("returns a single parse error for unreadable input", () => {
    const result = check("name: orders", "id\n1\n");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe(PARSE_ERROR_CODE);
    expect(result.issues[0]?.severity).toBe("error");
    expect(result.counts.error).toBe(1);
    expect(result.rows).toBe(0);
  });

  test("returns a parse error when the CSV has no header", () => {
    const result = check(CONTRACT, "");
    expect(result.issues[0]?.code).toBe(PARSE_ERROR_CODE);
  });

  test("a clean dataset produces no errors", () => {
    const result = check(CONTRACT, "id,amount\n1,5\n2,10\n");
    expect(result.counts.error).toBe(0);
  });
});

describe("lintOnly", () => {
  test("lints with an empty dataset", () => {
    const result = lintOnly("schema:\n  - name: orders", "orders");
    expect(result.rows).toBe(0);
    expect(result.dataset).toBe("-");
    expect(result.issues.some((issue) => issue.code === "DP-101")).toBe(true);
  });

  test("reports a parse error for unreadable contracts", () => {
    const result = lintOnly("schema: 5");
    expect(result.issues[0]?.code).toBe(PARSE_ERROR_CODE);
  });
});

describe("countIssues", () => {
  test("counts by severity", () => {
    expect(
      countIssues([
        { code: "a", severity: "error", location: "-", message: "" },
        { code: "b", severity: "warning", location: "-", message: "" },
        { code: "c", severity: "warning", location: "-", message: "" },
        { code: "d", severity: "info", location: "-", message: "" },
      ]),
    ).toEqual({ error: 1, warning: 2, info: 1 });
  });
});
