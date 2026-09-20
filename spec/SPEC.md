# datapact rule specification

**Subset:** Open Data Contract Standard (ODCS)
**Status:** draft, version 0.1
**Editor:** svx
**Repository:** https://github.com/srivtx/datapact
**Reference contract:** [`example-contract.yaml`](./example-contract.yaml)
**Reference data:** [`example-data.csv`](./example-data.csv)

## Abstract

`datapact` is an offline data-contract runtime. It parses an Open Data Contract
Standard (ODCS) contract in YAML or JSON, lints the contract, and validates a
CSV dataset against it. Everything runs locally, in the browser or in CI, with
no warehouse connection and no upload.

This document specifies the exact subset of ODCS that `datapact` understands, the
meaning of every field it reads, the logical types and formats it checks, the
rules it enforces with their codes and severities, the CSV parsing rules, the
suppression cap, and the output and exit-code contract. Everything here is
normative unless marked otherwise.

## Why a subset

ODCS is broad: it describes servers, pricing, SLA, roles, quality, and more.
`datapact` deliberately implements only the part that can be checked from one
contract and one data file with no external system: the `schema` and its
properties. Any other ODCS field is accepted and ignored rather than rejected.

## The contract document

A contract is UTF-8 YAML or JSON. `datapact` uses two top-level fields, `name`
and `schema`, and ignores the rest.

### Top level

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | no (recommended) | The contract name. Used in reports. Missing or empty is `DP-109`. |
| `schema` | array of schema objects | yes | The schemas the contract describes. |

`schema` MUST be an array. A top-level value that is not a mapping, a missing or
non-array `schema`, a property that is not an object, and a property without a
`name` all fail parsing and are reported as `DP-PARSE-000` with exit code `2`
rather than linted. A schema entry that is not an object is accepted and linted
as a schema with no properties (`DP-101`).

If `schema` is absent or empty, the contract declares no columns; every column in
the data is then undeclared (`DP-202`).

### Schema objects

Each element of `schema` is an object:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | no | The schema (table) name. Used in finding locations; a missing name is shown as `<schema>` and is not a finding on its own. |
| `properties` | array of property objects | yes | The columns of the schema. Missing or not an array is `DP-101`. |

### Property objects

Each element of `properties` is an object. All fields other than `name` and
`logicalType` are optional.

| Field | Type | Meaning |
|---|---|---|
| `name` | string | The column name. Matched to the CSV header exactly (case-sensitive). A property without a name fails parsing (`DP-PARSE-000`); a duplicate within the same schema is `DP-102`. |
| `logicalType` | string | The column's logical type, from the list below. The alias `type` is also accepted. Missing or unknown is `DP-103`. |
| `required` | boolean | When `true`, the column MUST be present in the CSV header (`DP-201`) and MUST NOT be empty in any row (`DP-204`). A non-boolean is coerced: a non-zero number, or the string `true`, `1`, or `yes` (case-insensitive), means `true`. |
| `unique` | boolean | When `true`, non-empty values in the column MUST be unique across rows (`DP-205`). Coerced the same way as `required`. |
| `enum` | array | The allowed values. Each entry is compared as text (non-strings are stringified). A value not in the list is `DP-209`. An empty array is `DP-106`. |
| `pattern` | string | An ECMAScript regular expression tested unanchored against the field text. A value that does not match is `DP-208`. A pattern that does not compile is `DP-104`. |
| `format` | string | A semantic format, from the list below, checked in addition to the logical type (`DP-210`). An unknown format is `DP-107`. |
| `minimum` | number | The inclusive lower bound for a `number` or `integer` value (`DP-206`). A numeric string is accepted. Present but not a finite number, or greater than `maximum`, is `DP-105`. |
| `maximum` | number | The inclusive upper bound for a `number` or `integer` value (`DP-207`). A numeric string is accepted. Present but not a finite number, or less than `minimum`, is `DP-105`. |
| `description` | string | Documentation. Read but not enforced. |

`minimum` and `maximum` are enforced only for the `number` and `integer` logical
types; on any other type they are ignored.

Setting `required` or `unique` on an `object` or `array` property is flagged by
`DP-108` as not meaningful, because those values are not type-checked. The runtime
still applies the presence and uniqueness checks to the column.

### Logical types

| `logicalType` | Accepted values |
|---|---|
| `string` | Any non-empty UTF-8 text. A string value never produces a type mismatch. |
| `number` | Any text that JavaScript `Number()` parses to a finite value, for example `12`, `-3.5`, `1e3`, or `0x10`. `NaN` and `Infinity` are mismatches. |
| `integer` | A base-10 integer matching `^-?\d+$` (a leading `+` is not accepted). |
| `boolean` | `true`, `false`, `yes`, `no`, `1`, or `0`, case-insensitive. |
| `date` | A calendar date, exactly `YYYY-MM-DD`, validated against the real calendar (including leap years). |
| `date-time` | Any text that JavaScript `Date.parse()` accepts, such as an ISO 8601 date-time (`2026-01-05T09:12:00Z`). The parser is permissive and is not a strict ISO 8601 grammar. |
| `timestamp` | Any text that JavaScript `Date.parse()` accepts, the same as `date-time`. |
| `object` | Not type-checked. Any non-empty text is accepted; the value is not parsed as JSON. |
| `array` | Not type-checked. Any non-empty text is accepted; the value is not parsed as JSON. |

A logical type not in this table is `DP-103`.

### Formats

| `format` | Accepted values |
|---|---|
| `date` | A calendar date, exactly `YYYY-MM-DD`. |
| `date-time` | A value that JavaScript `Date.parse()` accepts, as the `date-time` logical type. |
| `email` | A value matching `^[^\s@]+@[^\s@]+\.[^\s@]+$`: a non-empty local part, an `@`, and a dotted domain with no whitespace. |
| `uri` | A value that the `URL` constructor accepts, which requires an absolute URL with a scheme and no whitespace. |
| `uuid` | A canonical hyphenated UUID, `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`. |
| `ipv4` | Four groups of one to three decimal digits, each `0`–`255`, separated by `.`. Leading zeros are accepted. |

A format not in this table is `DP-107`, and no format check runs for that
property.

When a property's `format` merely repeats its logical type — `format: date` on a
`date` property, or `format: date-time` on a `date-time` or `timestamp` property —
`DP-210` is skipped, because the logical-type check already covers the value.

## Empty values

A field is **empty** when it has zero length. Both an unquoted empty field and a
quoted empty field (`""`) are empty. A field containing only whitespace is not
empty.

- In a **required** column, an empty field is `DP-204`. No further per-cell check
  runs for that field.
- In an **optional** column, an empty field is skipped by the type, pattern,
  enum, format, minimum, maximum, and uniqueness checks. An empty cell in an
  optional column is never an error.

This is the rule that lets a sparse column validate cleanly: absence is not a
type error unless the contract marks the column required.

## Lint rules (contract)

Linting needs only the contract. It runs before any data is read.

| Code | Severity | Check |
|---|---|---|
| `DP-101` | error | A schema entry has no `properties` array, or a property object lacks a `name`. A property without a name normally fails parsing first, so this is `DP-PARSE-000`. |
| `DP-102` | error | A property name is duplicated within the same schema. |
| `DP-103` | error | A property has a missing or unknown `logicalType`. |
| `DP-104` | error | A `pattern` is not a valid regular expression. |
| `DP-105` | error | A `minimum` or `maximum` is not a finite number, or `minimum > maximum`. |
| `DP-106` | warning | An `enum` is present but empty, so it constrains nothing. |
| `DP-107` | warning | A `format` is present but not supported, so no format check runs. |
| `DP-108` | warning | `required` or `unique` is set on an `object` or `array` property, whose values are not type-checked. |
| `DP-109` | info | The contract has no top-level `name`. |

## Validation rules (data)

Validation needs the contract and a CSV dataset. It runs after linting. Every
check that applies to a column runs on each non-empty cell, so one cell can
produce more than one finding. A numeric check (`DP-206`, `DP-207`) only fires
when the value parses to a finite number, so a type mismatch on a numeric column
does not also produce a bounds finding.

| Code | Severity | Check |
|---|---|---|
| `DP-201` | error | A `required` column is absent from the CSV header. |
| `DP-202` | info | A CSV header column is not declared in the contract. |
| `DP-203` | error | A value does not parse as the column's logical type. |
| `DP-204` | error | A value is empty in a `required` column. |
| `DP-205` | error | A non-empty value repeats in a `unique` column. |
| `DP-206` | error | A numeric value is below `minimum`. |
| `DP-207` | error | A numeric value is above `maximum`. |
| `DP-208` | error | A value does not match `pattern`. |
| `DP-209` | error | A value is not in `enum`. |
| `DP-210` | error | A value does not match `format`. |

`DP-205` compares values as exact, case-sensitive text; `1` and `1.0` are
different values. Empty fields are never counted as duplicates.

## Suppression and the cap (`DP-250`)

A large dataset can produce a finding on millions of cells. To keep a report
usable, `datapact` caps the number of **validation** findings it reports per rule
code at **50** per run. When a rule would report more than 50 findings, the first
50 are kept, the remainder are suppressed, and a single `DP-250` finding of
severity `info` is emitted for that rule code recording how many findings were
suppressed. Contract lint findings are not capped.

| Code | Severity | Check |
|---|---|---|
| `DP-250` | info | More than 50 findings of one rule code were produced; the extras were suppressed. |

The cap is applied independently to each validation rule code. `DP-250` and
`DP-PARSE-000` are never capped, and one `DP-250` is emitted per truncated code.

## Parse errors (`DP-PARSE-000`)

| Code | Severity | Check |
|---|---|---|
| `DP-PARSE-000` | error | The contract or the CSV could not be parsed. |

`DP-PARSE-000` is emitted when the contract is not valid YAML or JSON, when the
contract is structurally invalid (the top level is not a mapping, `schema` is
missing or not an array, or a property is not an object or lacks a `name`), or
when the CSV has no header row. JSON is parsed by the same YAML reader, so a
JSON contract is valid input.

When either the contract or the CSV fails to parse, the run yields a single
`DP-PARSE-000` with severity `error`, location `-`, and the parse message. It
always exits `2` and is never reported as a clean run, so a gate cannot pass on
unreadable input.

## CSV parsing

The data file is read as CSV according to [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180):

- **Encoding.** UTF-8. A leading UTF-8 byte-order mark (BOM) is stripped before
  parsing.
- **Records.** Fields are separated by commas (`,`). Records are terminated by
  CRLF (`\r\n`) or LF (`\n`); a lone CR is also accepted as a record terminator.
- **Quoted fields.** A field may be enclosed in double quotes (`"`). Inside a
  quoted field a literal double quote is written doubled (`""`). A quoted field
  may contain commas, CR, LF, and quotes. A quote only opens a field at its start;
  a doubled quote inside quotes is one literal quote.
- **Header.** The first record is the header. Header names are matched to
  property names exactly (case-sensitive), independent of column order. A header
  name that repeats is ignored after its first occurrence.
- **Blank lines.** Empty lines are skipped and never become records.
- **Ragged rows.** A row with fewer fields than the header is padded with empty
  fields for the missing trailing columns. A row with more fields than the header
  ignores the extra fields.
- **Trailing newline.** A final line break is optional.
- **No inference.** Every field is text first; the contract's `logicalType`
  decides how it is interpreted.

## Output and exit codes

Text output is line-oriented: one finding per line, each starting with its code
and severity, then a human-readable message with the location. `--json` emits a
stable, machine-readable document. The CLI can also write [SARIF
2.1.0](https://docs.oasis-open.org/sarif/v2.1.0/sarif-v2.1.0.html) for code
scanning.

Every finding carries a `code`, a `severity` (`error`, `warning`, or `info`), a
`message`, and a `location`. The location is the schema and property, for example
`orders.item_count`, or the bare column name for an undeclared column. A data
finding names the 1-based data row in its message.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | No findings at or above `--fail-on`. |
| `1` | At least one finding at or above `--fail-on`. |
| `2` | Invalid usage, or input that could not be parsed (`DP-PARSE-000`). |
| `3` | I/O error: a file could not be read, or a report could not be written. |

## Examples

A minimal contract, with the CSV that satisfies it:

```yaml
name: users
schema:
  - name: users
    properties:
      - name: id
        logicalType: string
        required: true
        format: uuid
      - name: email
        logicalType: string
        required: true
        format: email
      - name: age
        logicalType: integer
        minimum: 0
        maximum: 150
```

```
id,email,age
8b1e5a7c-2d3f-4a6b-8c9d-0e1f2a3b4c5d,ada@example.com,36
```

The fully worked contract is [`example-contract.yaml`](./example-contract.yaml)
and the data file is [`example-data.csv`](./example-data.csv). The data file is
valid RFC 4180 CSV and deliberately violates rules. A conforming run against it
reports:

| Where | Code | Why |
|---|---|---|
| header | `DP-201` | The required column `is_gift` is missing. |
| header | `DP-202` | The column `discount_code` is not declared in the contract. |
| row 2, `order_id` | `DP-208` | `ORD-2` does not match `^ORD-[0-9]{6}$`. |
| row 2, `item_count` | `DP-203` | `three` is not an integer. |
| row 3, `status` | `DP-209` | `refunded` is not in the enum. |
| row 3, `customer_email` | `DP-210` | `not-an-email` is not an email. |
| row 3, `item_count` | `DP-206` | `0` is below the minimum `1`. |
| row 3, `unit_price` | `DP-206` | `-1.00` is below the minimum `0`. |
| row 3, `total` | `DP-206` | `-1.00` is below the minimum `0`. |
| row 3, `currency` | `DP-208` | `usd` does not match `^[A-Z]{3}$`. |
| row 3, `order_date` | `DP-203` | `2026-13-40` is not a date. |
| row 3, `created_at` | `DP-203` | `not-a-date-time` is not parseable as a date-time. |
| row 3, `source_ip` | `DP-210` | `999.1.1.1` is not an IPv4 address. |
| row 4, `order_id` | `DP-205` | `ORD-000101` repeats the value in row 1 in a unique column. |
| row 4, `customer_email` | `DP-204` | The value is empty in a required column. |
| row 4, `item_count` | `DP-207` | `5000` is above the maximum `1000`. |
| row 5, `customer_id` | `DP-210` | `not-a-uuid` is not a UUID. |

Row 1 is clean. In row 5 the empty `shipping_address`, `source_ip`, and
`metadata` fields are skipped because those columns are optional, which
demonstrates the empty-value rule. The optional `note` column is absent from the
CSV entirely and is not a finding, because only `required` columns are checked
for presence.

## What this is not

- **Not a warehouse client.** There is no connection string, no SQL, and no
  driver. `datapact` never talks to a database; you hand it a file.
- **Not referential integrity.** It checks one dataset against one contract.
  Foreign keys, joins, and relationships between datasets are out of scope.
- **Not cross-column rules.** Each property is checked on its own. There are no
  expressions over several columns and no row-level formulas.
- **Not profiling.** It does not infer a schema, measure distributions, or
  suggest a contract from your data. You write the contract; it checks the data.
- **Not a full ODCS implementation.** Only `name` and `schema` are read; the rest
  of an ODCS document is accepted and ignored. See [Why a subset](#why-a-subset).
- **Not a service.** No upload, no account, no telemetry, and no network call at
  runtime. Parsing, linting, and validation all run in-process.

