import { describe, expect, test } from "bun:test";
import { parseCsv } from "../src/csv.ts";

describe("parseCsv", () => {
  test("parses a plain CSV", () => {
    const dataset = parseCsv("a,b\n1,2\n3,4");
    expect(dataset.columns).toEqual(["a", "b"]);
    expect(dataset.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  test("parses quoted fields containing commas", () => {
    const dataset = parseCsv('a,b\n"x,y",2');
    expect(dataset.rows).toEqual([{ a: "x,y", b: "2" }]);
  });

  test("parses embedded newlines inside quotes", () => {
    const dataset = parseCsv('a,b\n"line1\nline2",2');
    expect(dataset.rows).toEqual([{ a: "line1\nline2", b: "2" }]);
  });

  test("parses doubled quotes inside quoted fields", () => {
    const dataset = parseCsv('a,b\n"he said ""hi""",2');
    expect(dataset.rows).toEqual([{ a: 'he said "hi"', b: "2" }]);
  });

  test("handles CRLF line endings", () => {
    const dataset = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(dataset.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  test("tolerates a leading UTF-8 BOM", () => {
    const dataset = parseCsv("\ufeffa,b\n1,2");
    expect(dataset.columns).toEqual(["a", "b"]);
  });

  test("throws on an empty file", () => {
    expect(() => parseCsv("")).toThrow("the CSV has no header row");
  });

  test("throws when there is only whitespace/blank lines", () => {
    expect(() => parseCsv("\n\n")).toThrow("the CSV has no header row");
  });

  test("skips completely empty lines", () => {
    const dataset = parseCsv("a,b\n\n1,2\n\n");
    expect(dataset.rows).toEqual([{ a: "1", b: "2" }]);
  });

  test("keeps a quoted empty field as a data row", () => {
    const dataset = parseCsv('a\n""\n');
    expect(dataset.rows).toEqual([{ a: "" }]);
  });

  test("supports a custom delimiter", () => {
    const dataset = parseCsv("a;b\n1;2", { delimiter: ";" });
    expect(dataset.columns).toEqual(["a", "b"]);
    expect(dataset.rows).toEqual([{ a: "1", b: "2" }]);
  });

  test("keeps the first occurrence of a duplicate header", () => {
    const dataset = parseCsv("a,a,b\n1,2,3");
    expect(dataset.columns).toEqual(["a", "b"]);
    expect(dataset.rows).toEqual([{ a: "1", b: "3" }]);
  });

  test("parses a single-column file with no delimiter", () => {
    const dataset = parseCsv("name\nfoo\nbar");
    expect(dataset.columns).toEqual(["name"]);
    expect(dataset.rows).toEqual([{ name: "foo" }, { name: "bar" }]);
  });

  test("fills missing trailing fields with empty strings", () => {
    const dataset = parseCsv("a,b\n1");
    expect(dataset.rows).toEqual([{ a: "1", b: "" }]);
  });
});
