import { afterAll, beforeEach, expect, test } from "vitest";
import { closeDb, getDb } from "@/server/db/index.server";
import { guestBannedFromCall } from "@/features/room/server/room-bans.server";
import { excludeFromSession } from "@/features/room/server/session-exclusion.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { controlledRoom, grant, mockControlTransport } from "./support/host-controls";

/** Host controls on: a guest's ban is their exclusion from the open session. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

const noLiveKit = { roomSid: async () => undefined };

test("excluding a guest makes new guests of the session ask first; excluding an account does not", async () => {
  const room = await controlledRoom();
  const guest = "convidado-banido";
  await reserveAdmission(getDb(), grant(room.code, guest), 6);
  expect(await guestBannedFromCall(getDb(), noLiveKit, room.code)).toBe(false);

  await excludeFromSession(getDb(), {
    roomCode: room.code,
    identity: room.other,
    by: { userId: room.host },
  });
  expect(await guestBannedFromCall(getDb(), noLiveKit, room.code)).toBe(false);

  await excludeFromSession(getDb(), {
    roomCode: room.code,
    identity: guest,
    by: { userId: room.host },
  });
  expect(await guestBannedFromCall(getDb(), noLiveKit, room.code)).toBe(true);
});
