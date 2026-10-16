import { expect, test } from "vitest";
import { createJoinRequestGate } from "@/features/room/server/join-request-gate.server";

const account = (userId: string) => ({ userId });

test("one person opens at most 5 new requests in 10 minutes, whatever their IP", () => {
  const mayOpen = createJoinRequestGate();
  const ana = account("ana");
  const opened = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5", "10.0.0.6"].map(
    (ip) => mayOpen(ip, ana),
  );
  expect(opened).toEqual([true, true, true, true, true, false]);
  expect(mayOpen("10.0.0.7", account("bia"))).toBe(true);
});

test("one IP opens at most 10, even with a new guest id each time", () => {
  const mayOpen = createJoinRequestGate();
  const opened = Array.from({ length: 11 }, (_, index) =>
    mayOpen("203.0.113.9", { guestId: `convidado-${index}` }),
  );
  expect(opened.filter(Boolean)).toHaveLength(10);
  expect(opened.at(-1)).toBe(false);
});
