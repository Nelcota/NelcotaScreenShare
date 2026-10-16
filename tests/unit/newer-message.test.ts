import { expect, test } from "vitest";
import { isNewerMessage } from "@/features/messages/domain/newer-message";

const older = "01a13d51-2209-7a72-aa2d-486c78e64a06";
const newer = "01a13d51-2b0f-7a72-aa2d-486c78e64a06";

/** Reading the newest conversation made an older unread the latest, and it notified again. */
test("only a message after the newest one seen is new", () => {
  expect(isNewerMessage(newer, older)).toBe(true);
  expect(isNewerMessage(older, newer)).toBe(false);
  expect(isNewerMessage(older, older)).toBe(false);
  expect(isNewerMessage(older, undefined)).toBe(true);
});
