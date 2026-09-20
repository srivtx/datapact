#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { check, lintOnly } from "./check.ts";
import { serve } from "./mcp.ts";
import { formatJson, formatText } from "./report.ts";
import { writeSarif } from "./sarif.ts";
import { PARSE_ERROR_CODE, type Severity, type ValidationResult } from "./types.ts";

export type FailOn = "error" | "warning" | "info" | "none";

export interface Options {
  command: "check" | "lint" | "mcp" | null;
  contract: string | null;
  data: string | null;
  json: boolean;
  quiet: boolean;
  sarif: string | null;
  failOn: FailOn;
  help: boolean;
  version: boolean;
}

const FAIL_ON_VALUES: FailOn[] = ["error", "warning", "info", "none"];

function readVersion(): string {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = readVersion();

const USAGE = `datapact - offline data-contract runtime

Parse an Open Data Contract Standard contract (YAML or JSON), lint the contract,
and validate a CSV dataset against it. Nothing leaves your machine.

Usage:
  datapact check --contract <file> --data <csv> [--json] [--sarif <path>] [--fail-on <level>]
  datapact lint  --contract <file>            [--json] [--fail-on <level>]
  datapact mcp

Options:
  --contract <path>       The ODCS contract (YAML or JSON)
  --data <path>           The CSV dataset to validate
  --json                  Print machine-readable JSON
  --quiet, -q             Print a single summary line
  --sarif <path>          Write a SARIF 2.1.0 report to <path>
  --fail-on <level>       Exit non-zero at this severity or above:
                          error (default), warning, info, none
  -h, --help              Show this help
  -v, --version           Print the version

Exit codes:
  0  no issues at or above --fail-on
  1  at least one issue at or above --fail-on
  2  invalid usage, or a contract or dataset that could not be parsed
  3  I/O error (a file could not be read, or the report could not be written)
`;

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    command: null,
    contract: null,
    data: null,
    json: false,
    quiet: false,
    sarif: null,
    failOn: "error",
    help: false,
    version: false,
  };

  const value = (arg: string, flag: string, next: string | undefined): string => {
    const inline = arg.startsWith(`${flag}=`);
    const v = inline ? arg.slice(flag.length + 1) : next;
    if (v === undefined || v.length === 0 || (!inline && v.startsWith("-"))) {
      throw new Error(`${flag} requires a value`);
    }
    return v;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--") break;
    if (arg === "check" || arg === "lint" || arg === "mcp") {
      if (opts.command !== null) throw new Error(`unexpected command ${arg}`);
      opts.command = arg;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--quiet" || arg === "-q") {
      opts.quiet = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--version" || arg === "-v") {
      opts.version = true;
    } else if (arg === "--contract" || arg.startsWith("--contract=")) {
      opts.contract = value(arg, "--contract", argv[++i]);
    } else if (arg === "--data" || arg.startsWith("--data=")) {
      opts.data = value(arg, "--data", argv[++i]);
    } else if (arg === "--sarif" || arg.startsWith("--sarif=")) {
      opts.sarif = value(arg, "--sarif", argv[++i]);
    } else if (arg === "--fail-on" || arg.startsWith("--fail-on=")) {
      const v = value(arg, "--fail-on", argv[++i]);
      if (!FAIL_ON_VALUES.includes(v as FailOn)) {
        throw new Error(`Invalid --fail-on value: ${v} (expected error, warning, info, or none)`);
      }
      opts.failOn = v as FailOn;
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      throw new Error(`unexpected argument ${arg}`);
    }
  }
  return opts;
}

function exceedsFailOn(counts: Record<Severity, number>, failOn: FailOn): boolean {
  switch (failOn) {
    case "none":
      return false;
    case "info":
      return counts.error > 0 || counts.warning > 0 || counts.info > 0;
    case "warning":
      return counts.error > 0 || counts.warning > 0;
    case "error":
      return counts.error > 0;
  }
}

async function readText(path: string): Promise<string> {
  try {
    return await Bun.file(path).text();
  } catch (err) {
    throw new Error(`cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`datapact: ${err instanceof Error ? err.message : String(err)}`);
    console.error(USAGE);
    return 2;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.version) {
    console.log(VERSION);
    return 0;
  }
  if (opts.command === null) {
    console.error("datapact: expected `check`, `lint`, or `mcp`");
    console.error(USAGE);
    return 2;
  }
  if (opts.command === "mcp") {
    await serve({ version: VERSION });
    return 0;
  }
  if (opts.contract === null) {
    console.error("datapact: --contract is required");
    console.error(USAGE);
    return 2;
  }
  if (opts.command === "check" && opts.data === null) {
    console.error("datapact: check needs --data");
    console.error(USAGE);
    return 2;
  }

  let result: ValidationResult;
  let source = "datapact";
  try {
    const contractText = await readText(opts.contract);
    if (opts.command === "check") {
      const dataText = await readText(opts.data!);
      result = check(contractText, dataText, {
        contractName: basename(opts.contract),
        datasetName: basename(opts.data!),
      });
      source = "datapact";
    } else {
      result = lintOnly(contractText, basename(opts.contract));
    }
  } catch (err) {
    console.error(`datapact: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }

  if (opts.json) {
    console.log(formatJson(result));
  } else if (opts.quiet) {
    console.log(
      `${result.contract}: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
    );
  } else {
    console.log(formatText(result));
  }

  if (opts.sarif !== null) {
    try {
      await writeSarif(opts.sarif, result, "datapact", VERSION);
    } catch (err) {
      console.error(
        `datapact: cannot write SARIF report to ${opts.sarif}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 3;
    }
  }

  if (result.issues.some((issue) => issue.code === PARSE_ERROR_CODE)) return 2;
  return exceedsFailOn(result.counts, opts.failOn) ? 1 : 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
