import type { Contract, ContractProperty, ContractSchema, Dataset, Issue } from "./types.ts";

const FINDING_LIMIT = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function propertiesOf(entry: ContractSchema): ContractProperty[] {
  const value = (entry as { properties?: unknown }).properties;
  return Array.isArray(value) ? (value as ContractProperty[]) : [];
}

function schemaNameOf(entry: ContractSchema): string {
  return typeof entry?.name === "string" && entry.name.length > 0 ? entry.name : "<schema>";
}

function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) {
      return false;
    }
  }
  return true;
}

function checkType(value: string, logicalType: string): boolean {
  switch (logicalType) {
    case "string":
      return value.length > 0;
    case "integer":
      return /^-?\d+$/.test(value);
    case "number":
      return value.length > 0 && Number.isFinite(Number(value));
    case "boolean": {
      const normalized = value.toLowerCase();
      return (
        normalized === "true" ||
        normalized === "false" ||
        normalized === "0" ||
        normalized === "1" ||
        normalized === "yes" ||
        normalized === "no"
      );
    }
    case "date":
      return isRealDate(value);
    case "date-time":
    case "timestamp":
      return Number.isFinite(Date.parse(value));
    case "object":
    case "array":
      return true;
    default:
      return true;
  }
}

function checkFormat(value: string, format: string): boolean {
  switch (format) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "uri":
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case "uuid":
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        value,
      );
    case "ipv4":
      return isIpv4(value);
    case "date":
      return isRealDate(value);
    case "date-time":
      return Number.isFinite(Date.parse(value));
    default:
      return true;
  }
}

function formatDuplicatesType(format: string, logicalType: string): boolean {
  if (format === "date" && logicalType === "date") {
    return true;
  }
  if (format === "date-time" && (logicalType === "date-time" || logicalType === "timestamp")) {
    return true;
  }
  return false;
}

function isNumericType(logicalType: string): boolean {
  return logicalType === "number" || logicalType === "integer";
}

export function validateDataset(contract: Contract, dataset: Dataset): Issue[] {
  const issues: Issue[] = [];
  const emitted = new Map<string, number>();
  const suppressed = new Map<string, number>();

  const push = (issue: Issue): void => {
    const count = emitted.get(issue.code) ?? 0;
    if (count >= FINDING_LIMIT) {
      suppressed.set(issue.code, (suppressed.get(issue.code) ?? 0) + 1);
      return;
    }
    emitted.set(issue.code, count + 1);
    issues.push(issue);
  };

  const entries = Array.isArray(contract.schema) ? contract.schema : [];
  const columns = Array.isArray(dataset.columns) ? dataset.columns : [];
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];

  const declared = new Set<string>();
  for (const entry of entries) {
    for (const property of propertiesOf(entry)) {
      if (isRecord(property) && typeof property.name === "string") {
        declared.add(property.name);
      }
    }
  }

  for (const column of columns) {
    if (!declared.has(column)) {
      push({
        code: "DP-202",
        severity: "info",
        location: column,
        message: `column "${column}" is not declared in the contract`,
      });
    }
  }

  for (const entry of entries) {
    const schemaName = schemaNameOf(entry);
    for (const property of propertiesOf(entry)) {
      if (!isRecord(property) || typeof property.name !== "string" || property.name.length === 0) {
        continue;
      }

      const name = property.name;
      const location = `${schemaName}.${name}`;

      if (!columns.includes(name)) {
        if (property.required === true) {
          push({
            code: "DP-201",
            severity: "error",
            location,
            message: `required column "${name}" is missing from the dataset`,
          });
        }
        continue;
      }

      const uniqueSeen = property.unique === true ? new Set<string>() : undefined;

      for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r] ?? {};
        const raw = row[name];
        const value = typeof raw === "string" ? raw : "";
        const rowNumber = r + 1;

        if (value === "") {
          if (property.required === true) {
            push({
              code: "DP-204",
              severity: "error",
              location,
              message: `row ${rowNumber}: required column "${name}" is empty`,
            });
          }
          continue;
        }

        if (uniqueSeen !== undefined) {
          if (uniqueSeen.has(value)) {
            push({
              code: "DP-205",
              severity: "error",
              location,
              message: `row ${rowNumber}: duplicate value "${truncate(value)}" in unique column "${name}"`,
            });
          } else {
            uniqueSeen.add(value);
          }
        }

        const logicalType = property.logicalType as string;
        if (!checkType(value, logicalType)) {
          push({
            code: "DP-203",
            severity: "error",
            location,
            message: `row ${rowNumber}: "${truncate(value)}" is not a valid ${logicalType}`,
          });
        }

        if (isNumericType(logicalType)) {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            if (
              property.minimum !== undefined &&
              Number.isFinite(property.minimum) &&
              numeric < property.minimum
            ) {
              push({
                code: "DP-206",
                severity: "error",
                location,
                message: `row ${rowNumber}: value "${truncate(value)}" is below minimum ${property.minimum}`,
              });
            }
            if (
              property.maximum !== undefined &&
              Number.isFinite(property.maximum) &&
              numeric > property.maximum
            ) {
              push({
                code: "DP-207",
                severity: "error",
                location,
                message: `row ${rowNumber}: value "${truncate(value)}" is above maximum ${property.maximum}`,
              });
            }
          }
        }

        if (typeof property.pattern === "string" && property.pattern.length > 0) {
          try {
            if (!new RegExp(property.pattern).test(value)) {
              push({
                code: "DP-208",
                severity: "error",
                location,
                message: `row ${rowNumber}: value "${truncate(value)}" does not match pattern ${property.pattern}`,
              });
            }
          } catch {
            // An invalid pattern is reported by the linter (DP-104); skip it here.
          }
        }

        if (
          Array.isArray(property.enum) &&
          property.enum.length > 0 &&
          !property.enum.includes(value)
        ) {
          push({
            code: "DP-209",
            severity: "error",
            location,
            message: `row ${rowNumber}: value "${truncate(value)}" is not in the enum for "${name}"`,
          });
        }

        if (
          typeof property.format === "string" &&
          !formatDuplicatesType(property.format, logicalType) &&
          !checkFormat(value, property.format)
        ) {
          push({
            code: "DP-210",
            severity: "error",
            location,
            message: `row ${rowNumber}: value "${truncate(value)}" is not a valid ${property.format}`,
          });
        }
      }
    }
  }

  for (const [code, count] of suppressed) {
    issues.push({
      code: "DP-250",
      severity: "info",
      location: code,
      message: `${count} ${code} finding(s) were suppressed after the first ${FINDING_LIMIT}`,
    });
  }

  return issues;
}
