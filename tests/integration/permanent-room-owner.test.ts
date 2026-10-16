import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomDefinitions, roomSessions } from "@/server/db/schema/room-control";
import { roomRoles } from "@/server/db/schema";
import { applyRoleChange } from "@/features/room/server/role-changes.server";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import { reconcileSessionPresence } from "@/features/room/server/session-presence.server";
import { controlledRoom, mockControlTransport, participant } from "./support/host-controls";

/**
 * A permanent room stays with whoever created it: the owner passes the host, never the room,
 * and takes the host back only after joining again.
 */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

async function personalControlledRoom() {
  const room = await controlledRoom();
  await getDb()
    .update(roomDefinitions)
    .set({ kind: "personal", name: "Plantão" })
    .where(eq(roomDefinitions.code, room.code));
  return room;
}

async function ownerOf(code: string) {
  const [definition] = await getDb()
    .select({ ownerUserId: roomDefinitions.ownerUserId })
    .from(roomDefinitions)
    .where(eq(roomDefinitions.code, code));
  return definition?.ownerUserId;
}

test("the owner of a personal room moderates, but does not give the room away", async () => {
  const room = await personalControlledRoom();
  expect(await roomRoleOf(getDb(), { roomCode: room.code, userId: room.host })).toBe("owner");

  const promoted = await applyRoleChange(getDb(), {
    roomCode: room.code,
    actorUserId: room.host,
    targetUserId: room.other,
    change: "promote",
  });
  expect(promoted.ok).toBe(true);
  const transferred = await applyRoleChange(getDb(), {
    roomCode: room.code,
    actorUserId: room.host,
    targetUserId: room.other,
    change: "transfer",
  });
  expect(transferred).toEqual({ ok: false, error: "permanent" });
  expect(await ownerOf(room.code)).toBe(room.host);
});

async function session(id: string) {
  const [found] = await getDb().select().from(roomSessions).where(eq(roomSessions.id, id));
  if (!found) throw new Error("Missing session");
  return found;
}

const reconcile = async (id: string, people: ReturnType<typeof participant>[]) =>
  getDb().transaction(async (tx) =>
    reconcileSessionPresence(tx, await session(id), people, new Date()),
  );

test("the owner passes the host and keeps the room; it comes back only on rejoining", async () => {
  const room = await personalControlledRoom();
  await room.command({ kind: "transfer", identity: room.other });
  expect(await ownerOf(room.code)).toBe(room.host);
  expect((await session(room.sessionId)).hostUserId).toBe(room.other);

  // Still in the call: the owner does not take the host back.
  const present = [participant(room.host, 1), participant(room.other, 2)];
  expect((await reconcile(room.sessionId, present)).hostUserId).toBe(room.other);

  // Back after leaving: the owner's priority applies again.
  const rejoined = Math.floor(Date.now() / 1000) + 5;
  const back = [participant(room.other, 2), participant(room.host, rejoined)];
  const updated = await reconcile(room.sessionId, back);
  expect(updated.hostUserId).toBe(room.host);
  expect(updated.hostGivenAt).toBeNull();
});

test("in a one-off room the owner's host transfer still hands over the room", async () => {
  const room = await controlledRoom();
  await getDb().insert(roomRoles).values({ roomCode: room.code, userId: room.host, role: "owner" });
  await room.command({ kind: "transfer", identity: room.other });
  expect(await ownerOf(room.code)).toBe(room.other);
  expect((await session(room.sessionId)).hostGivenAt).toBeNull();
});
