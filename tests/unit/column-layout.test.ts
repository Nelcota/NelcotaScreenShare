import { describe, expect, test } from "vitest";
import {
  clampColumnWidth,
  COLUMN_WIDTH,
  DEFAULT_COLUMN_LAYOUT,
  parseColumnLayout,
  serializeColumnLayout,
} from "@/features/friends/domain/column-layout";

describe("friends column layout", () => {
  test("goes through the cookie and back", () => {
    const layout = { collapsed: true, width: 333 };
    const header = `tema=escuro; nelcota_column=${serializeColumnLayout(layout)}`;
    expect(parseColumnLayout(header)).toEqual(layout);
  });

  test("keeps the width between the limits", () => {
    expect(clampColumnWidth(10)).toBe(COLUMN_WIDTH.min);
    expect(clampColumnWidth(9_000)).toBe(COLUMN_WIDTH.max);
    expect(clampColumnWidth(Number.NaN)).toBe(COLUMN_WIDTH.initial);
    expect(parseColumnLayout("nelcota_column=0.9999")).toEqual({
      collapsed: false,
      width: COLUMN_WIDTH.max,
    });
  });

  test("anything odd falls back to the open column", () => {
    expect(parseColumnLayout(null)).toEqual(DEFAULT_COLUMN_LAYOUT);
    expect(parseColumnLayout("nelcota_column=sim")).toEqual(DEFAULT_COLUMN_LAYOUT);
    expect(parseColumnLayout("outro=1.300")).toEqual(DEFAULT_COLUMN_LAYOUT);
  });
});
