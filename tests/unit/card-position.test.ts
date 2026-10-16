import { describe, expect, it, test } from "vitest";
import {
  clampOffset,
  nudgeOffset,
  parseOffset,
  snapToCorner,
} from "@/features/room/domain/card-position";

const card = { width: 300, height: 52 };
const viewport = { width: 1280, height: 720 };

test("a card dragged past an edge stays whole on screen", () => {
  // At the top it stops below the top bar (5rem), never on the page's header.
  expect(clampOffset({ right: -40, bottom: 900 }, card, viewport)).toEqual({
    right: 8,
    bottom: 588,
  });
  expect(clampOffset({ right: 2000, bottom: -5 }, card, viewport)).toEqual({
    right: 972,
    bottom: 8,
  });
  expect(clampOffset({ right: 120, bottom: 300 }, card, viewport)).toEqual({
    right: 120,
    bottom: 300,
  });
});

test("a window smaller than the card keeps it at the near edges", () => {
  expect(clampOffset({ right: 50, bottom: 50 }, card, { width: 200, height: 40 })).toEqual({
    right: 8,
    bottom: 8,
  });
});

test("only an offset written here is read back", () => {
  expect(parseOffset(JSON.stringify({ right: 20, bottom: 30 }))).toEqual({ right: 20, bottom: 30 });
  expect(parseOffset(null)).toBeUndefined();
  expect(parseOffset("{")).toBeUndefined();
  expect(parseOffset(JSON.stringify({ right: "20", bottom: 30 }))).toBeUndefined();
  expect(parseOffset(JSON.stringify({ right: null, bottom: 30 }))).toBeUndefined();
  expect(parseOffset("[1,2]")).toBeUndefined();
});

test("arrow keys move the card; Shift moves it further", () => {
  const offset = { right: 100, bottom: 100 };
  expect(nudgeOffset(offset, "ArrowLeft", false)).toEqual({ right: 116, bottom: 100 });
  expect(nudgeOffset(offset, "ArrowRight", false)).toEqual({ right: 84, bottom: 100 });
  expect(nudgeOffset(offset, "ArrowUp", true)).toEqual({ right: 100, bottom: 164 });
  expect(nudgeOffset(offset, "ArrowDown", false)).toEqual({ right: 100, bottom: 84 });
  expect(nudgeOffset(offset, "Enter", false)).toBeUndefined();
});

describe("a dropped card", () => {
  const callCard = { width: 300, height: 80 };
  const screen = { width: 1280, height: 800 };

  it("goes to the nearest corner: below the top bar, above a message box", () => {
    // Near the top left.
    expect(snapToCorner({ right: 900, bottom: 600 }, callCard, screen)).toEqual({
      right: 1280 - 300 - 16,
      bottom: 800 - 80 - 80,
    });
    // Near the bottom right.
    expect(snapToCorner({ right: 40, bottom: 30 }, callCard, screen)).toEqual({
      right: 16,
      bottom: 96,
    });
    // Near the top right, close to an edge but not a corner.
    expect(snapToCorner({ right: 200, bottom: 650 }, callCard, screen)).toEqual({
      right: 16,
      bottom: 640,
    });
  });

  it("stays where it was dropped in the middle of the screen", () => {
    const middle = { right: 490, bottom: 360 };
    expect(snapToCorner(middle, callCard, screen)).toEqual(middle);
  });
});
