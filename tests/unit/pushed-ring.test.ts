import { expect, test } from "vitest";
import { shownPushedRing } from "@/features/ringing/client/pushed-ring";

const ring = {
  id: "r1",
  callerId: "c",
  callerName: "Caio",
  roomCode: "abc-defg-hij",
  startedAt: 0,
  expiresAt: 90_000,
};
const before = { incoming: [], outgoing: [] };
const after = { incoming: [], outgoing: [] };

/** A pushed ring kept showing after the page learned it ended: Entrar said it was over. */
test("the pushed ring fills the gap only until the page reloads its data", () => {
  expect(shownPushedRing({ ring, seenWith: before }, before)).toBe(ring);
  expect(shownPushedRing({ ring, seenWith: before }, after)).toBeNull();
  expect(shownPushedRing(null, before)).toBeNull();
});
