import type { Contract, ContractProperty, ContractSchema, Issue } from "./types.ts";

const LOGICAL_TYPES = new Set<string>([
  "string",
  "number",
  "integer",
  "boolean",
  "date",
  "date-time",
  "timestamp",
  "object",
  "array",
]);

const KNOWN_FORMATS = new Set<string>([
  "date",
  "date-time",
  "email",
  "uri",
  "uuid",
  "ipv4",
]);

function schemaLocation(entry: ContractSchema): string {
  return entry.name && entry.name.length > 0 ? entry.name : "<schema>";
}

function propertyLocation(entry: ContractSchema, property: ContractProperty): string {
  const name = typeof property?.name === "string" ? property.name : "";
  return name.length > 0 ? `${schemaLocation(entry)}.${name}` : schemaLocation(entry);
}

function propertiesOf(entry: ContractSchema): ContractProperty[] | undefined {
  const value = (entry as { properties?: unknown }).properties;
  return Array.isArray(value) ? (value as ContractProperty[]) : undefined;
}

export function lintContract(contract: Contract): Issue[] {
  const issues: Issue[] = [];

  const entries = Array.isArray(contract.schema) ? contract.schema : [];

  for (const entry of entries) {
    const schemaLoc = schemaLocation(entry);
    const properties = propertiesOf(entry);

    if (properties === undefined) {
      issues.push({
        code: "DP-101",
        severity: "error",
        location: schemaLoc,
        message: `schema "${schemaLoc}" has no properties array`,
      });
      continue;
    }

    const seen = new Set<string>();
    for (const property of properties) {
      if (property === null || typeof property !== "object") {
        issues.push({
          code: "DP-101",
          severity: "error",
          location: schemaLoc,
          message: `schema "${schemaLoc}" has a property without a name`,
        });
        continue;
      }

      const name = typeof property.name === "string" ? property.name : "";
      if (name.length === 0) {
        issues.push({
          code: "DP-101",
          severity: "error",
          location: schemaLoc,
          message: `schema "${schemaLoc}" has a property without a name`,
        });
        continue;
      }

      const location = propertyLocation(entry, property);

      if (seen.has(name)) {
        issues.push({
          code: "DP-102",
          severity: "error",
          location,
          message: `duplicate property "${name}" in schema "${schemaLoc}"`,
        });
      } else {
        seen.add(name);
      }

      const logicalType = property.logicalType as string;
      if (!LOGICAL_TYPES.has(logicalType)) {
        issues.push({
          code: "DP-103",
          severity: "error",
          location,
          message: `unknown logicalType "${String(logicalType)}" for property "${name}"`,
        });
      }

      if (typeof property.pattern === "string") {
        try {
          new RegExp(property.pattern);
        } catch {
          issues.push({
            code: "DP-104",
            severity: "error",
            location,
            message: `pattern for property "${name}" is not a valid regular expression`,
          });
        }
      }

      const { minimum, maximum } = property;
      if (minimum !== undefined && !Number.isFinite(minimum)) {
        issues.push({
          code: "DP-105",
          severity: "error",
          location,
          message: `minimum for property "${name}" is not a finite number`,
        });
      }
      if (maximum !== undefined && !Number.isFinite(maximum)) {
        issues.push({
          code: "DP-105",
          severity: "error",
          location,
          message: `maximum for property "${name}" is not a finite number`,
        });
      }
      if (
        minimum !== undefined &&
        maximum !== undefined &&
        Number.isFinite(minimum) &&
        Number.isFinite(maximum) &&
        minimum > maximum
      ) {
        issues.push({
          code: "DP-105",
          severity: "error",
          location,
          message: `minimum (${minimum}) is greater than maximum (${maximum}) for property "${name}"`,
        });
      }

      if (Array.isArray(property.enum) && property.enum.length === 0) {
        issues.push({
          code: "DP-106",
          severity: "warning",
          location,
          message: `enum for property "${name}" is empty`,
        });
      }

      if (typeof property.format === "string" && !KNOWN_FORMATS.has(property.format)) {
        issues.push({
          code: "DP-107",
          severity: "warning",
          location,
          message: `unknown format "${property.format}" for property "${name}"`,
        });
      }

      if (
        (logicalType === "object" || logicalType === "array") &&
        (property.required === true || property.unique === true)
      ) {
        issues.push({
          code: "DP-108",
          severity: "warning",
          location,
          message: `required/unique is not meaningful for ${logicalType} property "${name}"`,
        });
      }
    }
  }

  if (typeof contract.name !== "string" || contract.name.length === 0) {
    issues.push({
      code: "DP-109",
      severity: "info",
      location: "contract",
      message: "the contract has no name",
    });
  }

  issues.sort((a, b) => {
    if (a.code !== b.code) {
      return a.code < b.code ? -1 : 1;
    }
    if (a.location !== b.location) {
      return a.location < b.location ? -1 : 1;
    }
    return 0;
  });

  return issues;
}
