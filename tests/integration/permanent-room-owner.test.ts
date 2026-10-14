import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomDefinitions } from "@/server/db/schema/room-control";
import { applyRoleChange } from "@/features/room/server/role-changes.server";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import { controlledRoom, mockControlTransport } from "./support/host-controls";

/** A permanent room stays with whoever created it: its owner is not handed over in a call. */
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

test("the owner's host transfer in a personal room is refused instead of moving the room", async () => {
  const room = await personalControlledRoom();
  await expect(room.command({ kind: "transfer", identity: room.other })).rejects.toThrow(
    "Numa sala permanente",
  );
  expect(await ownerOf(room.code)).toBe(room.host);
});
