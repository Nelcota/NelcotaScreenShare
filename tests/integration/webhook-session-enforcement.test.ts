import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomSessions } from "@/server/db/schema/room-control";
import { excludeFromSession } from "@/features/room/server/session-exclusion.server";
import { removeBannedJoin } from "@/features/room/server/webhook/ban-enforcement.server";
import type { WebhookPayload } from "@/features/room/server/webhook/payload";
import { controlledRoom, mockControlTransport } from "./support/host-controls";

/**
 * With host controls the relay is the door, but a token kept from before can still reach
 * LiveKit directly if its signaling is exposed. The join webhook applies the session too:
 * excluded, closed or, while locked, never admitted, the person is disconnected again.
 */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

function gateway() {
  const removed: string[] = [];
  return {
    removed,
    async removeParticipant(_room: string, identity: string) {
      removed.push(identity);
      return true;
    },
  };
}

function joined(mediaRoomName: string, identity: string) {
  return {
    event: "participant_joined",
    room: { name: mediaRoomName, sid: "RM_session" },
    participant: { identity },
  } as WebhookPayload;
}

test("someone excluded from the session who joins anyway is removed again", async () => {
  const room = await controlledRoom();
  await excludeFromSession(getDb(), {
    roomCode: room.code,
    identity: room.other,
    by: { userId: room.host },
  });
  const livekit = gateway();
  expect(await removeBannedJoin(getDb(), livekit, joined(room.mediaRoomName, room.other))).toBe(
    true,
  );
  expect(livekit.removed).toEqual([room.other]);
});

test("a join into a closed session is removed; an admitted member is left alone", async () => {
  const room = await controlledRoom();
  const livekit = gateway();
  expect(await removeBannedJoin(getDb(), livekit, joined(room.mediaRoomName, room.other))).toBe(
    false,
  );
  await getDb()
    .update(roomSessions)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(roomSessions.id, room.sessionId));
  expect(await removeBannedJoin(getDb(), livekit, joined(room.mediaRoomName, room.other))).toBe(
    true,
  );
});

test("while the session is locked, someone never admitted is removed", async () => {
  const room = await controlledRoom();
  await getDb()
    .update(roomSessions)
    .set({ admissionLocked: true })
    .where(eq(roomSessions.id, room.sessionId));
  const livekit = gateway();
  expect(
    await removeBannedJoin(getDb(), livekit, joined(room.mediaRoomName, "convidado-de-fora")),
  ).toBe(true);
  expect(await removeBannedJoin(getDb(), livekit, joined(room.mediaRoomName, room.other))).toBe(
    false,
  );
  expect(livekit.removed).toEqual(["convidado-de-fora"]);
});
