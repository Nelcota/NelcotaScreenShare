import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { closeDb } from "@/server/db/index.server";
import { annotationRequest } from "@/features/room/server/annotations.server";
import { requestControlState } from "@/features/room/server/control-state.server";
import { mockControlTransport } from "./support/host-controls";

/**
 * The room's GETs take the room's lock: one member flooding them would hold up everyone's
 * admission and commands. Each person gets 120 a minute, three times what the app polls.
 */
const auth = vi.hoisted(() => ({ identity: "", kind: "account" as "account" | "guest" }));
vi.mock("@/features/room/server/room-caller.server", () => ({
  roomCaller: async () => (auth.identity ? { ...auth } : undefined),
}));
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

const LIMIT = 120;

async function statuses(send: () => Promise<Response>, count: number) {
  const seen: number[] = [];
  for (let index = 0; index < count; index++) seen.push((await send()).status);
  return seen;
}

test("the controls' state answers 429 past 120 reads a minute for the same person", async () => {
  // A session that does not exist: each read is refused early, the count is what matters.
  const room = { code: "abc-defg-hij", sessionId: crypto.randomUUID() };
  auth.identity = crypto.randomUUID();
  const url = `http://localhost:3000/api/sala/controles?${new URLSearchParams({ room: room.code, sessionId: room.sessionId })}`;
  const seen = await statuses(() => requestControlState(new Request(url)), LIMIT + 1);
  expect(seen.slice(0, LIMIT)).not.toContain(429);
  expect(seen.at(-1)).toBe(429);
});

test("the annotations' state answers 429 past 120 reads a minute for the same person", async () => {
  // A session that does not exist: each read is refused early, the count is what matters.
  const room = { code: "abc-defg-hij", sessionId: crypto.randomUUID() };
  auth.identity = crypto.randomUUID();
  const input = { room: room.code, sessionId: room.sessionId, trackSid: "TR_screen" };
  const url = `http://localhost:3000/api/sala/anotacoes?${new URLSearchParams(input)}`;
  const seen = await statuses(() => annotationRequest(new Request(url)), LIMIT + 1);
  expect(seen.slice(0, LIMIT)).not.toContain(429);
  expect(seen.at(-1)).toBe(429);
});
