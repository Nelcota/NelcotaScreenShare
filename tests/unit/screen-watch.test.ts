import { expect, test } from "vitest";
import { keepPublished, wantsTrack } from "@/features/room/domain/screen-watch";

const watched = new Set(["TR_screen"]);

test("voices always come in; a screen and its sound only once watched", () => {
  expect(wantsTrack(false, undefined, new Set())).toBe(true);
  expect(wantsTrack(false, "TR_screen", new Set())).toBe(true);
  expect(wantsTrack(true, "TR_screen", new Set())).toBe(false);
  expect(wantsTrack(true, "TR_screen", new Set())).toBe(false);
  expect(wantsTrack(true, "TR_screen", watched)).toBe(true);
  expect(wantsTrack(true, "TR_screen", watched)).toBe(true);
});

test("sound left behind by a screen that is gone stays out", () => {
  expect(wantsTrack(true, undefined, watched)).toBe(false);
});

test("sharing again needs another click: the old screen is dropped", () => {
  expect(keepPublished(watched, new Set(["TR_new"]))).toEqual(new Set());
  expect(keepPublished(watched, new Set(["TR_screen", "TR_other"]))).toBe(watched);
});
