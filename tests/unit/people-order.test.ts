import { expect, test } from "vitest";
import { othersPresenting, peopleOrder } from "@/features/room/domain/people-order";

const you = { identity: "voce", isLocal: true };
const ana = { identity: "ana", isLocal: false };
const bia = { identity: "bia", isLocal: false };
const order = (sharing: string[]) =>
  peopleOrder([you, ana, bia], new Set(sharing)).map((person) => person.identity);

test("with nobody presenting, the call's order stays", () => {
  expect(order([])).toEqual(["voce", "ana", "bia"]);
  expect(othersPresenting([you, ana], new Set())).toBe(false);
});

test("whoever presents comes first, and your own tile goes last", () => {
  expect(order(["bia"])).toEqual(["bia", "ana", "voce"]);
  expect(othersPresenting([you, bia], new Set(["bia"]))).toBe(true);
});

test("presenting yourself keeps you first; you are the one presenting", () => {
  expect(order(["voce"])).toEqual(["voce", "ana", "bia"]);
  expect(othersPresenting([you, ana], new Set(["voce"]))).toBe(false);
});
