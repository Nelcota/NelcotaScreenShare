import { expect, test } from "vitest";
import { fitTileGrid } from "@/features/room/domain/tile-grid";

const desktop = { width: 1500, height: 700, gap: 16, maxTileWidth: 1000 };

test("one person gets one large card, up to the maximum width", () => {
  expect(fitTileGrid({ ...desktop, count: 1 })).toEqual({ columns: 1, tileWidth: 1000 });
});

test("two people sit side by side", () => {
  expect(fitTileGrid({ ...desktop, count: 2 })).toEqual({ columns: 2, tileWidth: 742 });
});

test("three people go two above and one below, as in Discord", () => {
  const grid = fitTileGrid({ ...desktop, count: 3 });
  expect(grid.columns).toBe(2);
  // Two rows of 16:9 cards fit the height.
  expect(grid.tileWidth).toBe(608);
});

test("four people make two by two, and a tall area stacks them", () => {
  expect(fitTileGrid({ ...desktop, count: 4 }).columns).toBe(2);
  expect(fitTileGrid({ width: 400, height: 1200, gap: 16, maxTileWidth: 1000, count: 3 })).toEqual({
    columns: 1,
    tileWidth: 400,
  });
});

test("an area with no room yet gives no width instead of a negative one", () => {
  expect(
    fitTileGrid({ width: 0, height: 0, gap: 16, maxTileWidth: 1000, count: 2 }).tileWidth,
  ).toBe(0);
});
