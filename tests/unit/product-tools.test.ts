import { describe, it, expect } from "vitest";
import { slugify, skuPrefix, uniqueSlug, copySlug, parseCsv, csvCell, IMPORT_TEMPLATE, IMPORT_COLUMNS } from "@/lib/product-tools";

describe("product tools", () => {
  it("slugifies names", () => {
    expect(slugify("Baghdad Hoodie!")).toBe("baghdad-hoodie");
    expect(slugify("  Café  Tee — 2026 ")).toBe("cafe-tee-2026");
    expect(slugify("تيشيرت دجلة")).toBe("");
  });
  it("builds SKU prefixes", () => {
    expect(skuPrefix("baghdad-oversized-tee")).toBe("TP-BOT");
    expect(skuPrefix("")).toBe("TP-P");
  });
  it("finds free slugs and copy slugs", () => {
    expect(uniqueSlug("tee", new Set())).toBe("tee");
    expect(uniqueSlug("tee", new Set(["tee", "tee-2"]))).toBe("tee-3");
    expect(copySlug("tee", new Set())).toBe("tee-copy");
    expect(copySlug("tee-copy", new Set(["tee-copy"]))).toBe("tee-copy-2");
    expect(copySlug("tee-copy-2", new Set(["tee-copy", "tee-copy-2"]))).toBe("tee-copy-3");
  });
  it("parses CSV with quotes, Arabic, BOM and different delimiters", () => {
    expect(parseCsv('﻿a,b\n"x, y","he said ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
    expect(parseCsv("a;b;c\r\n1;2;3\r\n\r\n4;5;6")).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv('n\n"سطر 1\nسطر 2"')).toEqual([["n"], ["سطر 1\nسطر 2"]]);
  });
  it("the shipped template parses into the expected columns", () => {
    const rows = parseCsv(IMPORT_TEMPLATE);
    expect(rows[0]).toEqual([...IMPORT_COLUMNS]);
    expect(rows).toHaveLength(3);
    expect(rows[1]![0]).toBe("تيشيرت دجلة");
    expect(rows[1]![4]).toBe("S|M|L|XL");
  });
  it("neutralises formula injection in exports", () => {
    expect(csvCell("=SUM(A1)")).toBe(`"'=SUM(A1)"`);
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
