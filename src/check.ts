import { parseContract } from "./contract.ts";
import { parseCsv } from "./csv.ts";
import { lintContract } from "./lint.ts";
import { validateDataset } from "./validate.ts";
import { PARSE_ERROR_CODE } from "./types.ts";
import type { Contract, Dataset, Issue, Severity, ValidationResult } from "./types.ts";

export interface CheckOptions {
  contractName?: string;
  datasetName?: string;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function countIssues(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity] += 1;
  }
  return counts;
}

function parseFailure(name: string, dataset: string, error: unknown): ValidationResult {
  const issue: Issue = {
    code: PARSE_ERROR_CODE,
    severity: "error",
    location: "-",
    message: messageOf(error),
  };
  return {
    contract: name,
    dataset,
    rows: 0,
    issues: [issue],
    counts: countIssues([issue]),
  };
}

function contractLabel(contract: Contract, fallback: string): string {
  if (typeof contract.name === "string" && contract.name.length > 0) {
    return contract.name;
  }
  if (typeof contract.id === "string" && contract.id.length > 0) {
    return contract.id;
  }
  return fallback;
}

export function check(
  contractText: string,
  csvText: string,
  options: CheckOptions = {},
): ValidationResult {
  let contract: Contract;
  let dataset: Dataset;
  try {
    contract = parseContract(contractText);
    dataset = parseCsv(csvText);
  } catch (error) {
    return parseFailure(options.contractName ?? "-", options.datasetName ?? "-", error);
  }

  const name = options.contractName ?? contractLabel(contract, "-");
  const label = options.datasetName ?? "-";
  const issues = [...lintContract(contract), ...validateDataset(contract, dataset)];

  return {
    contract: name,
    dataset: label,
    rows: dataset.rows.length,
    issues,
    counts: countIssues(issues),
  };
}

export function lintOnly(contractText: string, contractName?: string): ValidationResult {
  let contract: Contract;
  try {
    contract = parseContract(contractText);
  } catch (error) {
    return parseFailure(contractName ?? "-", "-", error);
  }

  const issues = lintContract(contract);

  return {
    contract: contractName ?? contractLabel(contract, "-"),
    dataset: "-",
    rows: 0,
    issues,
    counts: countIssues(issues),
  };
}
