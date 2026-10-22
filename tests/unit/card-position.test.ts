import { describe, expect, it, test } from "vitest";
import {
  clampOffset,
  clearOfAreas,
  coversAny,
  nudgeOffset,
  parseOffset,
  snapToEdge,
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

  it("goes into a corner when dropped close to two edges", () => {
    // Near the top left.
    expect(snapToEdge({ right: 900, bottom: 600 }, callCard, screen)).toEqual({
      right: 1280 - 300 - 16,
      bottom: 800 - 80 - 80,
    });
    // Near the bottom right.
    expect(snapToEdge({ right: 40, bottom: 30 }, callCard, screen)).toEqual({
      right: 16,
      bottom: 16,
    });
  });

  it("sticks to the nearest edge and keeps its place along it", () => {
    // Halfway down the right edge: it stays at that height instead of going down a corner.
    expect(snapToEdge({ right: 30, bottom: 360 }, callCard, screen)).toEqual({
      right: 16,
      bottom: 360,
    });
    // Near the top, away from the sides: it goes up and keeps its place across.
    expect(snapToEdge({ right: 200, bottom: 650 }, callCard, screen)).toEqual({
      right: 200,
      bottom: 640,
    });
    // Near the left edge, halfway down.
    expect(snapToEdge({ right: 950, bottom: 300 }, callCard, screen)).toEqual({
      right: 1280 - 300 - 16,
      bottom: 300,
    });
    // Near the bottom, in the middle across: against the bottom, same place across.
    expect(snapToEdge({ right: 490, bottom: 20 }, callCard, screen)).toEqual({
      right: 490,
      bottom: 16,
    });
  });

  it("dropped against the bottom, it stays there instead of floating up", () => {
    // Outside the start it rose 96 px, toward the middle of the screen.
    const dropped = snapToEdge({ right: 490, bottom: 8 }, callCard, screen);
    expect(dropped.bottom).toBe(16);
  });

  it("stays where it was dropped in the middle of the screen", () => {
    const middle = { right: 490, bottom: 360 };
    expect(snapToEdge(middle, callCard, screen)).toEqual(middle);
  });

  // The start's room field, in the middle of the screen, under the dropped card.
  const startField = { left: 400, top: 380, width: 480, height: 64 };

  it("goes to the nearest corner when dropped on the start's room field", () => {
    const middle = { right: 490, bottom: 360 };
    expect(snapToEdge(middle, callCard, screen, [startField])).toEqual({
      right: 16,
      bottom: 96,
    });
  });

  it("against the bottom, it keeps off a conversation's message box", () => {
    const messageBox = { left: 340, top: 720, width: 900, height: 72 };
    const dropped = snapToEdge({ right: 490, bottom: 8 }, callCard, screen, [messageBox]);
    expect(coversAny(dropped, callCard, screen, [messageBox])).toBe(false);
  });

  it("goes to a corner that is clear, not one on a tall message box", () => {
    // A long message being typed: the box covers both bottom corners.
    const tallBox = { left: 0, top: 560, width: 1280, height: 240 };
    const dropped = snapToEdge({ right: 490, bottom: 8 }, callCard, screen, [tallBox]);
    expect(coversAny(dropped, callCard, screen, [tallBox])).toBe(false);
  });

  it("stays in the middle when the field is elsewhere", () => {
    const middle = { right: 490, bottom: 360 };
    const farField = { left: 400, top: 100, width: 480, height: 64 };
    expect(snapToEdge(middle, callCard, screen, [farField])).toEqual(middle);
  });
});

describe("a saved card place", () => {
  const callCard = { width: 300, height: 80 };
  const screen = { width: 1280, height: 800 };
  const startField = { left: 400, top: 380, width: 480, height: 64 };

  it("moves to the nearest corner when another page has its field under it", () => {
    const middle = { right: 490, bottom: 360 };
    expect(coversAny(middle, callCard, screen, [startField])).toBe(true);
    expect(clearOfAreas(middle, callCard, screen, [startField])).toEqual({
      right: 16,
      bottom: 96,
    });
  });

  it("stays as saved where nothing is under it", () => {
    const corner = { right: 16, bottom: 96 };
    expect(coversAny(corner, callCard, screen, [startField])).toBe(false);
    expect(clearOfAreas(corner, callCard, screen, [startField])).toBe(corner);
    expect(clearOfAreas(corner, callCard, screen, [])).toBe(corner);
  });
});
