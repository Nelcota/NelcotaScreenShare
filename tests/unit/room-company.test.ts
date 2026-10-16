import { expect, test } from "vitest";
import { hasHadCompany, othersInCall, peopleView } from "@/features/room/domain/room-company";

const connected = { connectedOnce: true };

test("alone from the start: nobody has been in the call yet", () => {
  expect(hasHadCompany(false, { ...connected, others: 0 })).toBe(false);
});

test("someone else joins: the call has had company", () => {
  expect(hasHadCompany(false, { ...connected, others: 1 })).toBe(true);
});

test("alone again after others left: the call still had company", () => {
  expect(hasHadCompany(true, { ...connected, others: 0 })).toBe(true);
});

test("people seen while connecting are not company yet", () => {
  expect(hasHadCompany(false, { connectedOnce: false, others: 1 })).toBe(false);
});

test("my own identity from another tab is not someone else", () => {
  expect(othersInCall("ana", ["ana", "bia"])).toBe(1);
  expect(othersInCall("ana", ["ana"])).toBe(0);
  expect(othersInCall("ana", [])).toBe(0);
});

test("before the first connection the people area waits instead of drawing the grid", () => {
  expect(peopleView({ connectedOnce: false, hasStage: false, others: 0 })).toBe("pending");
});

test("connected and nobody else: the alone screen, also while reconnecting", () => {
  expect(peopleView({ connectedOnce: true, hasStage: false, others: 0 })).toBe("alone");
});

test("connected with others: the grid", () => {
  expect(peopleView({ connectedOnce: true, hasStage: false, others: 2 })).toBe("grid");
});

test("a stage always shows the people strip", () => {
  expect(peopleView({ connectedOnce: false, hasStage: true, others: 0 })).toBe("grid");
  expect(peopleView({ connectedOnce: true, hasStage: true, others: 0 })).toBe("grid");
});
