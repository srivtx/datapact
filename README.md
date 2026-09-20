# datapact

> Lint an ODCS contract and validate a CSV against it, offline.

**Offline data-contract runtime: parse and lint an Open Data Contract Standard (ODCS) contract, then validate a CSV dataset against it, in the browser or in CI. No warehouse connection, no upload.**

**by svx** · MIT Licensed

[![CI](https://github.com/srivtx/datapact/actions/workflows/ci.yml/badge.svg)](https://github.com/srivtx/datapact/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/srivtx/datapact?sort=semver&color=0f766e)](https://github.com/srivtx/datapact/releases)
[![license](https://img.shields.io/badge/license-MIT-0f766e)](LICENSE)

---

**Live site:** [datapact](https://srivtx.github.io/datapact)  ·  **Source:** [github.com/srivtx/datapact](https://github.com/srivtx/datapact)

**Docs:** [Rules](https://srivtx.github.io/datapact/rules)  ·  [Usage](https://srivtx.github.io/datapact/usage)  ·  [CI](https://srivtx.github.io/datapact/ci)  ·  [FAQ](https://srivtx.github.io/datapact/faq)

## Why

A data contract is usually a document: written once, filed, and never enforced.
The producer starts emitting nulls, renames a column, or changes a currency code,
and nothing fails until a dashboard breaks or a downstream job reads garbage.
The contract was never wrong; it was just never checked.

The main open-source engine for this is Python and connection-centric: it wants a
warehouse, credentials, and a running server. Most teams do not need that. They
need to answer one question in a pull request: does this file match this
contract?

`datapact` answers exactly that, and nothing else. It reads a contract and a data
file from disk, checks one against the other, and exits non-zero when they
disagree. It runs in the browser, in a pre-commit hook, or in CI, with no
connection string and no upload.

## What it does

- **Parses ODCS** — YAML or JSON, reading the `schema` array and the properties
  in it. The rest of the document is accepted and ignored.
- **Lints the contract** — duplicate or missing names, unknown logical types,
  invalid regular expressions, bad numeric bounds, empty enums, unknown formats,
  and `required`/`unique` on `object`/`array` properties (`DP-101`–`DP-109`).
- **Validates a CSV against it** — missing required columns, undeclared columns,
  type mismatches, empty required values, uniqueness, bounds, patterns, enums,
  and formats (`DP-201`–`DP-210`), with a per-rule suppression cap (`DP-250`).
- **Stays offline** — no network code, no warehouse driver, no telemetry. Your
  data never leaves the machine.
- **Speaks to CI and agents** — human-readable text, stable JSON, and SARIF
  2.1.0, with a documented exit-code scheme.

## Install

`datapact` is not published to npm. Install it from GitHub with the one-line
script (requires [Bun](https://bun.sh)):

```bash
# One-line install (installs the `datapact` binary)
curl -fsSL https://raw.githubusercontent.com/srivtx/datapact/main/install.sh | sh

# Or run once, without installing
bunx github:srivtx/datapact#main --help

# Install globally
bun add -g github:srivtx/datapact
datapact --help

# Add to a project as a dev dependency
bun add -d github:srivtx/datapact
```

## Usage (CLI)

```bash
# Lint a contract on its own
datapact lint --contract spec/example-contract.yaml

# Lint the contract and validate a dataset against it
datapact check --contract spec/example-contract.yaml --data spec/example-data.csv

# Machine-readable output for a program
datapact check --contract contract.yaml --data orders.csv --json

# Write a SARIF report and fail on warnings as well as errors
datapact check --contract contract.yaml --data orders.csv --sarif datapact.sarif --fail-on warning
```

Every option that takes a value accepts both `--flag value` and `--flag=value`.
The failure threshold is one of `error` (the default), `warning`, `info`, or
`none`; it affects only the exit code, and every finding is still reported.

## Library

The same engine is exported for use in your own code. It is browser-safe: no
`node:` imports, so it runs in a page as well as in Bun.

```ts
import { parseContract, parseCsv, lintContract, validateDataset } from "datapact";

const contract = parseContract(contractSource);
const dataset = parseCsv(csvSource);

const issues = [...lintContract(contract), ...validateDataset(contract, dataset)];
for (const issue of issues) {
  console.log(issue.code, issue.severity, issue.message);
}
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | No findings at or above `--fail-on` |
| `1` | At least one finding at or above `--fail-on` |
| `2` | Invalid usage, or input that could not be parsed (`DP-PARSE-000`) |
| `3` | I/O error: an input file could not be read, or a report could not be written |

An unreadable or structurally invalid contract is never reported as clean: it
produces a `DP-PARSE-000` error and exit code `2`, so a CI gate cannot pass on
input the tool did not understand.

## For agents

Every surface is built to be read by a program: stable rule codes, stable JSON,
SARIF 2.1.0, and a documented exit-code scheme, so an agent can consume findings
without scraping a screen.

- **Docs index:** the site serves a machine-readable index at
  [srivtx.github.io/datapact/llms.txt](https://srivtx.github.io/datapact/llms.txt).
- **Agent guide:** [`AGENTS.md`](AGENTS.md) covers build, test, layout, and the
  hard rules.
- **MCP server:** expose the runtime to any MCP-capable agent over stdio.

  ```json
  { "mcpServers": { "datapact": { "command": "bunx", "args": ["github:srivtx/datapact#main", "mcp"] } } }
  ```

## License

[MIT](LICENSE).
