import { describe, expect, test } from "bun:test";
import { lintContract } from "../src/lint.ts";
import { parseContract } from "../src/contract.ts";
import type { Contract, ContractProperty, LogicalType } from "../src/types.ts";

function property(
  name: string,
  logicalType: LogicalType,
  extra: Partial<ContractProperty> = {},
): ContractProperty {
  return { name, logicalType, required: false, unique: false, ...extra };
}

function contract(name: string, properties: ContractProperty[]): Contract {
  return { name, schema: [{ name: "orders", logicalType: "object", properties }] };
}

function codes(issues: ReturnType<typeof lintContract>): string[] {
  return issues.map((issue) => issue.code);
}

describe("lintContract", () => {
  test("DP-101 flags a schema entry with no properties array", () => {
    const issues = lintContract(parseContract("schema:\n  - name: orders"));
    expect(codes(issues)).toContain("DP-101");
  });

  test("DP-101 flags a property with no name", () => {
    const bad: Contract = {
      schema: [
        {
          name: "orders",
          logicalType: "object",
          properties: [{ name: "" } as ContractProperty],
        },
      ],
    };
    expect(codes(lintContract(bad))).toContain("DP-101");
  });

  test("DP-102 flags duplicate property names", () => {
    const issues = lintContract(
      contract("orders", [property("id", "integer"), property("id", "integer")]),
    );
    expect(codes(issues)).toContain("DP-102");
  });

  test("DP-103 flags an unknown logicalType", () => {
    const issues = lintContract(
      contract("orders", [property("id", "text" as LogicalType)]),
    );
    expect(codes(issues)).toContain("DP-103");
  });

  test("DP-104 flags an uncompilable pattern", () => {
    const issues = lintContract(contract("orders", [property("id", "string", { pattern: "[" })]));
    expect(codes(issues)).toContain("DP-104");
  });

  test("DP-105 flags a non-finite minimum", () => {
    const issues = lintContract(contract("orders", [property("id", "number", { minimum: NaN })]));
    expect(codes(issues)).toContain("DP-105");
  });

  test("DP-105 flags minimum greater than maximum", () => {
    const issues = lintContract(
      contract("orders", [property("id", "number", { minimum: 10, maximum: 1 })]),
    );
    expect(codes(issues)).toContain("DP-105");
  });

  test("DP-106 warns on an empty enum", () => {
    const issues = lintContract(contract("orders", [property("id", "string", { enum: [] })]));
    expect(codes(issues)).toContain("DP-106");
  });

  test("DP-107 warns on an unknown format", () => {
    const issues = lintContract(
      contract("orders", [property("id", "string", { format: "phone" })]),
    );
    expect(codes(issues)).toContain("DP-107");
  });

  test("DP-108 warns on required/unique for object and array properties", () => {
    const objectIssues = lintContract(
      contract("orders", [property("payload", "object", { required: true })]),
    );
    const arrayIssues = lintContract(
      contract("orders", [property("tags", "array", { unique: true })]),
    );
    expect(codes(objectIssues)).toContain("DP-108");
    expect(codes(arrayIssues)).toContain("DP-108");
  });

  test("DP-109 notes a contract with no name", () => {
    const issues = lintContract({ schema: [] });
    expect(codes(issues)).toContain("DP-109");
  });

  test("does not raise DP-109 when the contract is named", () => {
    expect(codes(lintContract(contract("orders", [])))).not.toContain("DP-109");
  });

  test("sorts issues by code then location", () => {
    const issues = lintContract({
      schema: [
        {
          name: "orders",
          logicalType: "object",
          properties: [property("z", "text" as LogicalType), property("a", "text" as LogicalType)],
        },
      ],
    });
    const sorted = [...issues].sort((x, y) =>
      x.code === y.code ? (x.location < y.location ? -1 : 1) : x.code < y.code ? -1 : 1,
    );
    expect(issues).toEqual(sorted);
  });
});
