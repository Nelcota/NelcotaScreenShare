import { expect, test } from "vitest";
import { periodParsers } from "@/lib/table-params";
import { periodBounds } from "@/server/table/period-filter.server";

test("a date that is not a real day is no filter, so the list and the date picker agree", () => {
  expect(periodParsers.de.parse("2026-13-45")).toBeNull();
  expect(periodParsers.ate.parse("2026-02-30")).toBeNull();
  expect(periodParsers.de.parse("ontem")).toBeNull();
  expect(periodParsers.de.parse("2026-10-14")).toBe("2026-10-14");
});

test("an inverted range is read in order instead of emptying the list", () => {
  const inOrder = periodBounds({ de: "2026-10-01", ate: "2026-10-10" });
  const inverted = periodBounds({ de: "2026-10-10", ate: "2026-10-01" });
  expect(inverted).toEqual(inOrder);
  expect(inOrder.from && inOrder.until && inOrder.from < inOrder.until).toBe(true);
  expect(periodBounds({ de: null, ate: null })).toEqual({ from: undefined, until: undefined });
});
