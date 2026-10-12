import { expect, test } from "vitest";
import { parseShareProfile, resolveShareProfile } from "@/features/room/domain/share-profile";

test("automatic preserves the tab's motion preset and the desktop's detail preset", () => {
  expect(resolveShareProfile("automatic", "browser")).toEqual({
    preset: "h1080fps30",
    contentHint: "motion",
  });
  for (const surface of ["monitor", "window"]) {
    expect(resolveShareProfile("automatic", surface)).toEqual({
      preset: "h1080fps15",
      contentHint: "detail",
    });
  }
});

test("an explicit profile takes precedence over the chosen surface", () => {
  for (const surface of ["browser", "monitor", "window"]) {
    expect(resolveShareProfile("text", surface)).toEqual({
      preset: "h1080fps15",
      contentHint: "text",
    });
    expect(resolveShareProfile("video", surface)).toEqual({
      preset: "h1080fps30",
      contentHint: "motion",
    });
    expect(resolveShareProfile("data-saver", surface)).toEqual({
      preset: "h720fps15",
      contentHint: "detail",
    });
  }
});

test("an old or invalid preference falls back to automatic", () => {
  for (const value of [null, undefined, {}, "", "4k", "automatic"]) {
    expect(parseShareProfile(value)).toBe("automatic");
  }
  expect(parseShareProfile("text")).toBe("text");
  expect(parseShareProfile("video")).toBe("video");
  expect(parseShareProfile("data-saver")).toBe("data-saver");
});
