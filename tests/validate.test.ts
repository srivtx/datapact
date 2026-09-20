import { describe, expect, test } from "bun:test";
import { validateDataset } from "../src/validate.ts";
import type { Contract, ContractProperty, Dataset, LogicalType } from "../src/types.ts";

function property(
  name: string,
  logicalType: LogicalType,
  extra: Partial<ContractProperty> = {},
): ContractProperty {
  return { name, logicalType, required: false, unique: false, ...extra };
}

function contract(properties: ContractProperty[]): Contract {
  return { name: "orders", schema: [{ name: "orders", logicalType: "object", properties }] };
}

function dataset(columns: string[], rows: Record<string, string>[]): Dataset {
  return { columns, rows };
}

function codes(issues: ReturnType<typeof validateDataset>): string[] {
  return issues.map((issue) => issue.code);
}

describe("validateDataset", () => {
  test("DP-201 reports a required property with no matching column", () => {
    const issues = validateDataset(
      contract([property("id", "integer", { required: true })]),
      dataset(["name"], [{ name: "x" }]),
    );
    expect(codes(issues)).toContain("DP-201");
  });

  test("DP-202 reports a dataset column not declared in the contract", () => {
    const issues = validateDataset(
      contract([property("id", "integer")]),
      dataset(["id", "extra"], [{ id: "1", extra: "y" }]),
    );
    expect(codes(issues)).toContain("DP-202");
  });

  test("DP-203 reports a value that does not match integer", () => {
    const issues = validateDataset(
      contract([property("id", "integer")]),
      dataset(["id"], [{ id: "abc" }]),
    );
    expect(codes(issues)).toContain("DP-203");
    expect(issues.find((issue) => issue.code === "DP-203")?.message).toContain("row 1");
  });

  test("DP-203 accepts valid values across logical types", () => {
    const issues = validateDataset(
      contract([
        property("i", "integer"),
        property("n", "number"),
        property("b", "boolean"),
        property("d", "date"),
        property("t", "date-time"),
      ]),
      dataset(
        ["i", "n", "b", "d", "t"],
        [{ i: "-3", n: "1.5", b: "YES", d: "2024-02-29", t: "2024-02-29T10:00:00Z" }],
      ),
    );
    expect(codes(issues)).not.toContain("DP-203");
  });

  test("DP-203 rejects an impossible calendar date", () => {
    const issues = validateDataset(
      contract([property("d", "date")]),
      dataset(["d"], [{ d: "2023-02-29" }]),
    );
    expect(codes(issues)).toContain("DP-203");
  });

  test("DP-204 reports an empty string in a required column", () => {
    const issues = validateDataset(
      contract([property("id", "integer", { required: true })]),
      dataset(["id"], [{ id: "" }]),
    );
    expect(codes(issues)).toContain("DP-204");
    expect(codes(issues)).not.toContain("DP-203");
  });

  test("DP-205 reports a repeated value in a unique column", () => {
    const issues = validateDataset(
      contract([property("id", "string", { unique: true })]),
      dataset(["id"], [{ id: "a" }, { id: "a" }, { id: "b" }]),
    );
    const unique = issues.filter((issue) => issue.code === "DP-205");
    expect(unique).toHaveLength(1);
    expect(unique[0]?.message).toContain("row 2");
  });

  test("DP-206 reports a value below the minimum", () => {
    const issues = validateDataset(
      contract([property("amount", "number", { minimum: 0 })]),
      dataset(["amount"], [{ amount: "-1" }]),
    );
    expect(codes(issues)).toContain("DP-206");
  });

  test("DP-207 reports a value above the maximum", () => {
    const issues = validateDataset(
      contract([property("amount", "number", { maximum: 10 })]),
      dataset(["amount"], [{ amount: "20" }]),
    );
    expect(codes(issues)).toContain("DP-207");
  });

  test("DP-208 reports a pattern mismatch when the value is non-empty", () => {
    const issues = validateDataset(
      contract([property("code", "string", { pattern: "^[A-Z]+$" })]),
      dataset(["code"], [{ code: "abc" }]),
    );
    expect(codes(issues)).toContain("DP-208");
  });

  test("DP-209 reports a value outside the enum", () => {
    const issues = validateDataset(
      contract([property("color", "string", { enum: ["red", "blue"] })]),
      dataset(["color"], [{ color: "green" }]),
    );
    expect(codes(issues)).toContain("DP-209");
  });

  test("DP-210 reports an invalid email, uri, uuid and ipv4", () => {
    const issues = validateDataset(
      contract([
        property("email", "string", { format: "email" }),
        property("site", "string", { format: "uri" }),
        property("uid", "string", { format: "uuid" }),
        property("ip", "string", { format: "ipv4" }),
      ]),
      dataset(
        ["email", "site", "uid", "ip"],
        [{ email: "nope", site: "not a url", uid: "123", ip: "999.1.1.1" }],
      ),
    );
    expect(issues.filter((issue) => issue.code === "DP-210")).toHaveLength(4);
  });

  test("DP-210 accepts valid format values", () => {
    const issues = validateDataset(
      contract([
        property("email", "string", { format: "email" }),
        property("site", "string", { format: "uri" }),
        property("uid", "string", { format: "uuid" }),
        property("ip", "string", { format: "ipv4" }),
      ]),
      dataset(
        ["email", "site", "uid", "ip"],
        [
          {
            email: "a@b.co",
            site: "https://example.com/x",
            uid: "123e4567-e89b-12d3-a456-426614174000",
            ip: "192.168.0.1",
          },
        ],
      ),
    );
    expect(codes(issues)).not.toContain("DP-210");
  });

  test("does not double-report a date format that duplicates the logical type", () => {
    const issues = validateDataset(
      contract([property("d", "date", { format: "date" })]),
      dataset(["d"], [{ d: "2020-13-01" }]),
    );
    expect(codes(issues)).toContain("DP-203");
    expect(codes(issues)).not.toContain("DP-210");
  });

  test("does not flag empty values on non-required columns", () => {
    const issues = validateDataset(
      contract([
        property("s", "string"),
        property("i", "integer", { minimum: 0, maximum: 10 }),
        property("color", "string", { enum: ["red"] }),
        property("email", "string", { format: "email" }),
      ]),
      dataset(["s", "i", "color", "email"], [{ s: "", i: "", color: "", email: "" }]),
    );
    expect(issues).toEqual([]);
  });

  test("does not flag uniqueness on empty non-required values", () => {
    const issues = validateDataset(
      contract([property("id", "string", { unique: true })]),
      dataset(["id"], [{ id: "" }, { id: "" }]),
    );
    expect(codes(issues)).not.toContain("DP-205");
  });

  test("a fully valid dataset yields zero issues", () => {
    const issues = validateDataset(
      contract([
        property("id", "integer", { required: true, unique: true }),
        property("name", "string"),
        property("amount", "number", { minimum: 0 }),
      ]),
      dataset(
        ["id", "name", "amount"],
        [
          { id: "1", name: "a", amount: "0" },
          { id: "2", name: "b", amount: "12.5" },
        ],
      ),
    );
    expect(issues).toEqual([]);
  });

  test("caps each code at 50 findings and adds DP-250", () => {
    const rows: Record<string, string>[] = [];
    for (let i = 0; i < 60; i += 1) {
      rows.push({ n: "not-a-number" });
    }
    const issues = validateDataset(contract([property("n", "integer")]), dataset(["n"], rows));
    expect(issues.filter((issue) => issue.code === "DP-203")).toHaveLength(50);
    const suppressed = issues.find((issue) => issue.code === "DP-250");
    expect(suppressed).toBeDefined();
    expect(suppressed?.message).toContain("10");
  });
});
