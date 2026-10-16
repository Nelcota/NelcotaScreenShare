import { expect, test } from "vitest";
import { gifListKey, gifListView } from "@/features/messages/domain/gif-list";
import type { Gif } from "@/features/messages/domain/klipy";

const gif = { slug: "a" } as Gif;

test("a search or trending does not depend on the favourites", () => {
  expect(gifListKey("trending", "", ["a"])).toBe(gifListKey("trending", "", ["a", "b"]));
  expect(gifListKey("favorites", "gato", ["a"])).toBe(gifListKey("trending", "gato", []));
  expect(gifListKey("favorites", "", ["a"])).not.toBe(gifListKey("favorites", "", ["a", "b"]));
});

test("before the first answer the list is loading, not empty", () => {
  expect(gifListView(undefined, "trending")).toEqual({ state: "loading" });
});

test("the old list does not show while the new one loads", () => {
  const trending = { key: "trending", gifs: [gif] };
  expect(gifListView(trending, "search:gato")).toEqual({ state: "loading" });
  expect(gifListView({ key: "search:gato", gifs: [] }, "search:gato")).toEqual({
    state: "ready",
    gifs: [],
  });
  expect(gifListView({ key: "trending", gifs: null }, "trending")).toEqual({ state: "failed" });
});
