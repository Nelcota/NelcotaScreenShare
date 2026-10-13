import { expect, test } from "vitest";
import { timeInCallLabel } from "@/features/room/domain/time-in-call";

const JOINED = new Date("2026-10-11T14:00:00Z");

function after(minutes: number, seconds = 0) {
  return new Date(JOINED.getTime() + minutes * 60_000 + seconds * 1000);
}

test("minutes up to an hour, then hours and minutes", () => {
  expect(timeInCallLabel(JOINED, after(0, 40))).toBe("há menos de 1 min");
  expect(timeInCallLabel(JOINED, after(1))).toBe("há 1 min");
  expect(timeInCallLabel(JOINED, after(12, 59))).toBe("há 12 min");
  expect(timeInCallLabel(JOINED, after(60))).toBe("há 1 h");
  expect(timeInCallLabel(JOINED, after(65))).toBe("há 1 h 5 min");
});

test("a clock slightly behind the join time does not show a negative time", () => {
  expect(timeInCallLabel(JOINED, after(-2))).toBe("há menos de 1 min");
});
