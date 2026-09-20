import { describe, expect, test } from "bun:test";
import { parseContract } from "../src/contract.ts";

const YAML_CONTRACT = `
apiVersion: v3
kind: DataContract
name: orders
status: active
schema:
  - name: orders
    logicalType: object
    properties:
      - name: id
        logicalType: integer
        required: true
        unique: true
      - name: amount
        logicalType: number
        minimum: 0
        maximum: 100000
        description: order total
`;

describe("parseContract", () => {
  test("parses a YAML contract", () => {
    const contract = parseContract(YAML_CONTRACT);
    expect(contract.apiVersion).toBe("v3");
    expect(contract.kind).toBe("DataContract");
    expect(contract.name).toBe("orders");
    expect(contract.status).toBe("active");
    expect(contract.schema).toHaveLength(1);
    const properties = contract.schema[0]?.properties ?? [];
    expect(properties).toHaveLength(2);
    expect(properties[0]?.name).toBe("id");
    expect(properties[0]?.logicalType).toBe("integer");
    expect(properties[0]?.required).toBe(true);
    expect(properties[0]?.unique).toBe(true);
    expect(properties[1]?.minimum).toBe(0);
    expect(properties[1]?.maximum).toBe(100000);
    expect(properties[1]?.description).toBe("order total");
  });

  test("parses a JSON contract (yaml parses JSON too)", () => {
    const json = JSON.stringify({
      name: "orders",
      schema: [
        {
          name: "orders",
          properties: [{ name: "id", logicalType: "integer" }],
        },
      ],
    });
    const contract = parseContract(json);
    expect(contract.name).toBe("orders");
    expect(contract.schema[0]?.properties[0]?.name).toBe("id");
  });

  test("falls back to `type` when `logicalType` is absent", () => {
    const contract = parseContract(`
schema:
  - name: orders
    properties:
      - name: note
        type: string
`);
    expect(contract.schema[0]?.properties[0]?.logicalType).toBe("string");
  });

  test("coerces required and unique to booleans", () => {
    const contract = parseContract(`
schema:
  - name: orders
    properties:
      - name: a
        logicalType: string
        required: "yes"
        unique: 1
      - name: b
        logicalType: string
        required: "false"
`);
    const properties = contract.schema[0]?.properties ?? [];
    expect(properties[0]?.required).toBe(true);
    expect(properties[0]?.unique).toBe(true);
    expect(properties[1]?.required).toBe(false);
    expect(properties[1]?.unique).toBe(false);
  });

  test("preserves enum, pattern and format", () => {
    const contract = parseContract(`
schema:
  - name: orders
    properties:
      - name: color
        logicalType: string
        enum: [red, blue]
        pattern: "^[a-z]+$"
        format: email
`);
    const property = contract.schema[0]?.properties[0];
    expect(property?.enum).toEqual(["red", "blue"]);
    expect(property?.pattern).toBe("^[a-z]+$");
    expect(property?.format).toBe("email");
  });

  test("throws when `schema` is missing", () => {
    expect(() => parseContract("name: orders")).toThrow(/not a data contract/);
  });

  test("throws when `schema` is not an array", () => {
    expect(() => parseContract("schema: 5")).toThrow(/not a data contract/);
  });

  test("throws when a property has no name", () => {
    expect(() =>
      parseContract(`
schema:
  - name: orders
    properties:
      - logicalType: string
`),
    ).toThrow(/not a data contract/);
  });

  test("does not throw for missing optional metadata", () => {
    expect(() =>
      parseContract(`
schema:
  - name: orders
    properties:
      - name: id
        logicalType: integer
`),
    ).not.toThrow();
  });
});
