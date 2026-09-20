import type { ValidationResult } from "./types.ts";

export function formatText(result: ValidationResult): string {
  const counts = result.counts ?? { error: 0, warning: 0, info: 0 };
  const header = `${result.dataset}  rows:${result.rows}  errors:${counts.error ?? 0}  warnings:${
    counts.warning ?? 0
  }  info:${counts.info ?? 0}`;

  const lines: string[] = [header];
  for (const issue of result.issues ?? []) {
    const location = issue.location && issue.location.length > 0 ? issue.location : "-";
    lines.push(`${issue.severity.toUpperCase()}  ${issue.code}  ${location}  ${issue.message}`);
  }
  return lines.join("\n");
}

export function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}
