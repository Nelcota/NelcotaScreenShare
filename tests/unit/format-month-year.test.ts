import assert from "node:assert/strict";
import { test } from "vitest";
import { formatMonthYear } from "@/lib/format";

test("month and year in São Paulo, a dash for an invalid date", () => {
  assert.equal(formatMonthYear(new Date("2026-10-14T12:00:00Z")), "outubro de 2026");
  // 1 November 01:00 UTC is still October in São Paulo.
  assert.equal(formatMonthYear(new Date("2026-11-01T01:00:00Z")), "outubro de 2026");
  assert.equal(formatMonthYear("not a date"), "—");
});
