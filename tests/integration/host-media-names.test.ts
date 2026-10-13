import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { closeDb, getDb } from "@/server/db/index.server";
import { and, eq } from "drizzle-orm";
import { roomBans, roomRoles } from "@/server/db/schema";
import { roomSessionMembers } from "@/server/db/schema/room-control";
import { controlGateway } from "@/features/room/server/control-gateway.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { removeFromCall } from "@/features/room/server/moderation.server";
import { bannedFromCall } from "@/features/room/server/room-bans.server";
import { authorizeSignal } from "@/features/room/server/signal-admission.server";
import { roomCodesForMedia } from "@/features/room/server/session-store.server";
import { removeBannedJoin } from "@/features/room/server/webhook/ban-enforcement.server";
import type { WebhookPayload } from "@/features/room/server/webhook/payload";
import { controlledRoom, grant, mockControlTransport } from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

/** LiveKit as seen by moderation: only the session's media room exists. */
function mediaOnlyGateway(mediaRoomName: string) {
  const calls: string[] = [];
  return {
    calls,
    async roomSid(room: string) {
      calls.push(`sid:${room}`);
      return room === mediaRoomName ? "RM_session" : undefined;
    },
    async removeParticipant(room: string) {
      calls.push(`remove:${room}`);
      return room === mediaRoomName;
    },
  };
}

test("the relay signs the saved role, not the participant default", async () => {
  const room = await controlledRoom();
  await getDb()
    .insert(roomRoles)
    .values({ roomCode: room.code, userId: room.other, role: "moderator" });
  const token = await liveKitGateway.signToken(grant(room.mediaRoomName, room.other));
  const signer = vi.spyOn(liveKitGateway, "signToken");
  await authorizeSignal(getDb(), token);
  expect(signer).toHaveBeenLastCalledWith(
    expect.objectContaining({ identity: room.other, role: "moderator" }),
  );
});

test("kicking reaches the call by its media name", async () => {
  const room = await controlledRoom();
  const gateway = mediaOnlyGateway(room.mediaRoomName);
  const kicked = await removeFromCall(
    getDb(),
    gateway,
    { room: room.code, identity: room.other, action: "kick" },
    { userId: room.host },
  );
  expect(kicked).toEqual({ ok: true });
  expect(gateway.calls).toEqual([`remove:${room.mediaRoomName}`]);
  expect(
    await bannedFromCall(getDb(), gateway, { roomCode: room.code, identity: room.other }),
  ).toBe(false);
});

test("banning excludes from the session, records who did it and disconnects", async () => {
  const room = await controlledRoom();
  const removal = vi.spyOn(controlGateway, "remove").mockResolvedValue();
  const gateway = mediaOnlyGateway(room.mediaRoomName);
  const banned = await removeFromCall(
    getDb(),
    gateway,
    { room: room.code, identity: room.other, action: "ban" },
    { userId: room.host },
  );
  expect(banned).toEqual({ ok: true });
  const [member] = await getDb()
    .select()
    .from(roomSessionMembers)
    .where(
      and(
        eq(roomSessionMembers.sessionId, room.sessionId),
        eq(roomSessionMembers.identity, room.other),
      ),
    );
  expect(member?.excludedAt).not.toBeNull();
  expect(member?.excludedByUserId).toBe(room.host);
  expect(removal).toHaveBeenCalledWith(room.mediaRoomName, room.other);
  expect(
    await bannedFromCall(getDb(), gateway, { roomCode: room.code, identity: room.other }),
  ).toBe(true);
  await expect(reserveAdmission(getDb(), grant(room.code, room.other), 6)).rejects.toMatchObject({
    code: "room_removed",
  });
});

test("a ban saved before the flag, joining through the media room, is found by the code", async () => {
  const room = await controlledRoom();
  const gateway = mediaOnlyGateway(room.mediaRoomName);
  await getDb()
    .insert(roomBans)
    .values({ roomCode: room.code, identity: room.other, livekitRoomSid: "RM_session" });
  const payload = {
    event: "participant_joined",
    room: { name: room.mediaRoomName, sid: "RM_session" },
    participant: { identity: room.other },
  } as WebhookPayload;
  expect(await removeBannedJoin(getDb(), gateway, payload)).toBe(true);
});

test("LiveKit names map back to codes; names of no session stay as they are", async () => {
  const room = await controlledRoom();
  expect(await roomCodesForMedia(getDb(), [room.mediaRoomName, "abc-defg-hij"])).toEqual([
    room.code,
    "abc-defg-hij",
  ]);
  expect(await roomCodesForMedia(getDb(), [])).toEqual([]);
});
