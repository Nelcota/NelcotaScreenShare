import assert from "node:assert/strict";
import { test } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";

test("CSV injection: formulas become text", () => {
  for (const evil of ['=HYPERLINK("x")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
    assert.ok(csvCell(evil).replace(/^"/, "").startsWith("'"), evil);
  }
  assert.equal(csvCell("normal"), "normal");
  assert.equal(csvCell(-5), "'-5", "negative numbers too (Excel would evaluate them)");
});

test("separator, quotes, line breaks and types", () => {
  assert.equal(csvCell('a;b"c'), '"a;b""c"');
  assert.equal(csvCell("linha\nnova"), '"linha\nnova"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(new Date("2026-10-06T12:00:00Z")), "2026-10-06T12:00:00.000Z");
  // JSON has quotes: it comes out quoted, with the inner ones doubled.
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
  assert.equal(csvRow(["a", 1, null]), "a;1;\r\n");
});

test("a comma stays inside the cell when the spreadsheet splits on commas", () => {
  // Opened with "," as separator (en-US), "x,=1+2" would become two cells and run "=1+2".
  assert.equal(csvCell("x,=1+2"), '"x,=1+2"');
  assert.equal(csvRow(["Ana", "x,=HYPERLINK(1)"]), 'Ana;"x,=HYPERLINK(1)"\r\n');
});
