import { expect, test } from "vitest";
import { hasHadCompany } from "@/features/room/domain/room-company";

test("alone from the start: nobody has been in the call yet", () => {
  expect(hasHadCompany(false, 1)).toBe(false);
  expect(hasHadCompany(false, 0)).toBe(false);
});

test("someone else joins: the call has had company", () => {
  expect(hasHadCompany(false, 2)).toBe(true);
});

test("alone again after others left: the call still had company", () => {
  expect(hasHadCompany(true, 1)).toBe(true);
});
