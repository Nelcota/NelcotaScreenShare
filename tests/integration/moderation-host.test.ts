import { afterAll, beforeEach, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomRoles } from "@/server/db/schema";
import { roomSessionMembers } from "@/server/db/schema/room-control";
import { moderateParticipant } from "@/features/room/server/moderation.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { account, controlledRoom, grant, mockControlTransport } from "./support/host-controls";

/** /api/sala/moderar with host controls on: the same rule as the host's own removal. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

const gateway = { roomSid: async () => "RM_call", removeParticipant: async () => true };

async function excluded(sessionId: string, identity: string) {
  const [member] = await getDb()
    .select({ excludedAt: roomSessionMembers.excludedAt })
    .from(roomSessionMembers)
    .where(
      and(eq(roomSessionMembers.sessionId, sessionId), eq(roomSessionMembers.identity, identity)),
    );
  return member?.excludedAt != null;
}

test("a moderator cannot ban or kick the session's host, only participants", async () => {
  const room = await controlledRoom();
  const moderator = room.other;
  await getDb()
    .insert(roomRoles)
    .values({ roomCode: room.code, userId: moderator, role: "moderator" });
  for (const action of ["ban", "kick"] as const) {
    const result = await moderateParticipant(getDb(), gateway, {
      room: room.code,
      identity: room.host,
      action,
      actorUserId: moderator,
    });
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  }
  expect(await excluded(room.sessionId, room.host)).toBe(false);

  const third = await account();
  await reserveAdmission(getDb(), grant(room.code, third), 6);
  await getDb()
    .update(roomSessionMembers)
    .set({ admittedAt: new Date() })
    .where(eq(roomSessionMembers.identity, third));
  expect(
    await moderateParticipant(getDb(), gateway, {
      room: room.code,
      identity: third,
      action: "ban",
      actorUserId: moderator,
    }),
  ).toEqual({ ok: true });
  expect(await excluded(room.sessionId, third)).toBe(true);
});
