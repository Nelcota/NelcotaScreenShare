import { afterAll, expect, test } from "vitest";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomBans } from "@/server/db/schema";
import { guestBannedFromCall } from "@/features/room/server/room-bans.server";

/** Host controls off: guest bans stay in room_bans, for the LiveKit call happening now. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "false";
afterAll(closeDb);

test("a guest banned from this call makes new guests ask first; one from an old call does not", async () => {
  const code = `legado-${crypto.randomUUID().slice(0, 8)}`;
  const thisCall = { roomSid: async () => "RM_agora" };
  expect(await guestBannedFromCall(getDb(), thisCall, code)).toBe(false);

  await getDb()
    .insert(roomBans)
    .values({ roomCode: code, identity: "convidado-antigo", livekitRoomSid: "RM_antes" });
  await getDb()
    .insert(roomBans)
    .values({ roomCode: code, identity: crypto.randomUUID(), livekitRoomSid: "RM_agora" });
  expect(await guestBannedFromCall(getDb(), thisCall, code)).toBe(false);

  await getDb()
    .insert(roomBans)
    .values({ roomCode: code, identity: "convidado-novo", livekitRoomSid: "RM_agora" });
  expect(await guestBannedFromCall(getDb(), thisCall, code)).toBe(true);
});
