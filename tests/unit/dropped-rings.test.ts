import { expect, test } from "vitest";
import { droppedRings } from "@/features/ringing/domain/dropped-rings";

const ringing = (id: string) => ({
  id,
  calleeId: "b",
  calleeName: "Bia Souza",
  state: "ringing" as const,
});

/** The server restarted mid-ring: the ring vanished and the caller kept "Chamando…" with no word. */
test("a ring gone after the server restarted is a dropped call", () => {
  const before = { serverStart: 1, outgoing: [ringing("r1")] };
  expect(droppedRings(before, { serverStart: 2, outgoing: [] })).toEqual([ringing("r1")]);
});

test("a ring gone on the same server was answered or cancelled, not dropped", () => {
  const before = { serverStart: 1, outgoing: [ringing("r1")] };
  expect(droppedRings(before, { serverStart: 1, outgoing: [] })).toEqual([]);
  expect(droppedRings(null, { serverStart: 2, outgoing: [] })).toEqual([]);
  expect(droppedRings(before, { serverStart: 2, outgoing: [ringing("r1")] })).toEqual([]);
});
