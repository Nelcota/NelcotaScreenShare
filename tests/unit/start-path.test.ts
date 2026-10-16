import { expect, test } from "vitest";
import { startPath } from "@/features/room/domain/start-path";

test("back to the start: the app for an account, the home page for a guest", () => {
  expect(startPath(true)).toBe("/inicio");
  expect(startPath(false)).toBe("/");
});
