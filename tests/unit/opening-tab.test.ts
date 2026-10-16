import { expect, test } from "vitest";
import { opensTab } from "@/features/friends/domain/opening-tab";

/** A clicked tab stayed unchanged until its loader came back; now it shows it is opening. */
test("the tab being opened is the one whose path the next page is under", () => {
  expect(opensTab("/salas", "/salas")).toBe(true);
  expect(opensTab("/salas/1", "/salas")).toBe(true);
  expect(opensTab("/salasx", "/salas")).toBe(false);
  expect(opensTab("/times", "/salas")).toBe(false);
  expect(opensTab(undefined, "/salas")).toBe(false);
});
