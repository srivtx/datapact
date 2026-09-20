# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.1.0

### Added

- Initial release of `datapact`.
- `parseContract(source)` parser for the supported ODCS subset (YAML or JSON),
  reading the `schema` array and its properties.
- `lintContract(source)` contract linting with `DP-101`–`DP-109`: duplicate and
  missing names, unknown logical types, invalid regexes, bad numeric bounds,
  empty enums, unknown formats, `required`/`unique` on `object`/`array`, and a
  missing contract name.
- `validateCsv(contract, data)` dataset validation with `DP-201`–`DP-210`:
  missing required columns, undeclared columns, type mismatches, empty required
  values, uniqueness, minimum, maximum, pattern, enum, and format.
- Logical types `string`, `number`, `integer`, `boolean`, `date`, `date-time`,
  `timestamp`, `object`, and `array`, and formats `date`, `date-time`, `email`,
  `uri`, `uuid`, and `ipv4`.
- RFC 4180 CSV parsing with BOM stripping, CRLF/LF/CR record endings, and quoted
  fields, including embedded commas, quotes, and newlines.
- Per-rule suppression cap with a `DP-250` notice and a `DP-PARSE-000` parse
  error.
- `datapact` CLI with `check` and `lint`, text, `--json`, and `--sarif` output,
  and the `--fail-on` gate.
- TypeScript library API and an MCP server entry point.
- The normative `spec/SPEC.md` with `spec/example-contract.yaml` and
  `spec/example-data.csv`.
