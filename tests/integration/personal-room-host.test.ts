import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomSessions } from "@/server/db/schema/room-control";
import { reconcileSessionPresence } from "@/features/room/server/session-presence.server";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import { personalRoom, liveCall } from "./support/workspaces";
import { account, mockControlTransport, participant } from "./support/host-controls";

/** A personal room's owner (ADR 0007): first in the election and taking the host back. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

test("the personal room's owner counts as its owner, without a saved role row", async () => {
  const { actor: owner, room } = await personalRoom();
  const guest = await account();
  expect(await roomRoleOf(getDb(), { roomCode: room.code, userId: owner })).toBe("owner");
  expect(await roomRoleOf(getDb(), { roomCode: room.code, userId: guest })).toBe("participant");
});

test("back in the call, the personal room's owner takes the host from whoever had it", async () => {
  const { actor: owner, room } = await personalRoom();
  const other = await account();
  const call = await liveCall(room.code, owner, [other]);
  // The owner dropped for a while and the other account was elected meanwhile.
  const [elected] = await getDb()
    .update(roomSessions)
    .set({ hostUserId: other })
    .where(eq(roomSessions.id, call.sessionId))
    .returning();
  if (!elected) throw new Error("Missing session");
  const people = [participant(other, 1), participant(owner, 2)];
  const reconciled = await getDb().transaction((tx) =>
    reconcileSessionPresence(tx, elected, people, new Date()),
  );
  expect(reconciled.hostUserId).toBe(owner);
});
