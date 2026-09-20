import type { Dataset } from "./types.ts";

export interface CsvOptions {
  delimiter?: string;
}

function isBlank(record: string[], quoted: boolean[]): boolean {
  return record.length === 1 && record[0] === "" && quoted[0] !== true;
}

export function parseCsv(text: string, options: CsvOptions = {}): Dataset {
  const delimiter = options.delimiter ?? ",";

  let source = text;
  if (source.length > 0 && source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }

  const records: string[][] = [];

  let record: string[] = [];
  let quoted: boolean[] = [];
  let field = "";
  let fieldQuoted = false;
  let inQuotes = false;

  const endField = (): void => {
    record.push(field);
    quoted.push(fieldQuoted);
    field = "";
    fieldQuoted = false;
  };

  const endRecord = (): void => {
    endField();
    if (!isBlank(record, quoted)) {
      records.push(record);
    }
    record = [];
    quoted = [];
  };

  let index = 0;
  const length = source.length;

  while (index < length) {
    const char = source[index] as string;

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      fieldQuoted = true;
      index += 1;
      continue;
    }

    if (char === delimiter) {
      endField();
      index += 1;
      continue;
    }

    if (char === "\r") {
      endRecord();
      index += 1;
      if (source[index] === "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "\n") {
      endRecord();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== "" || record.length > 0 || fieldQuoted || inQuotes) {
    endRecord();
  }

  const header = records[0];
  if (header === undefined) {
    throw new Error("the CSV has no header row");
  }

  const columns: string[] = [];
  const headerIndex: number[] = [];
  const seen = new Set<string>();
  for (let column = 0; column < header.length; column += 1) {
    const name = header[column] as string;
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    columns.push(name);
    headerIndex.push(column);
  }

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length; r += 1) {
    const source_row = records[r] as string[];
    const row: Record<string, string> = {};
    for (let column = 0; column < columns.length; column += 1) {
      const name = columns[column] as string;
      const at = headerIndex[column] as number;
      row[name] = source_row[at] ?? "";
    }
    rows.push(row);
  }

  return { columns, rows };
}
