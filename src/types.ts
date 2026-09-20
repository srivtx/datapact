export type Severity = "error" | "warning" | "info";

export const PARSE_ERROR_CODE = "DP-PARSE-000";

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  location: string;
  file?: string;
}

export type LogicalType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "date-time"
  | "timestamp"
  | "object"
  | "array";

export interface ContractProperty {
  name: string;
  logicalType: LogicalType;
  required: boolean;
  unique: boolean;
  enum?: string[];
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  description?: string;
}

export interface ContractSchema {
  name: string;
  logicalType: string;
  properties: ContractProperty[];
}

export interface Contract {
  apiVersion?: string;
  kind?: string;
  id?: string;
  name?: string;
  status?: string;
  schema: ContractSchema[];
}

export interface Dataset {
  columns: string[];
  rows: Record<string, string>[];
}

export interface ValidationResult {
  contract: string;
  dataset: string;
  rows: number;
  issues: Issue[];
  counts: Record<Severity, number>;
}
