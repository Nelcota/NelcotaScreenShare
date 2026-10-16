import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomDefinitions } from "@/server/db/schema/room-control";
import { createRoom } from "@/features/room/server/room-codes.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { account, grant, mockControlTransport } from "./support/host-controls";

/**
 * A room deleted while a token request was on its way (the owner deleted their account):
 * admission must not bring it back with whoever joins as its owner.
 */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

test("admission into a room deleted meanwhile is refused and does not recreate it", async () => {
  const owner = await account();
  const visitor = await account();
  const code = await createRoom(getDb(), owner);
  await getDb().delete(roomDefinitions).where(eq(roomDefinitions.code, code));

  await expect(reserveAdmission(getDb(), grant(code, visitor), 6)).rejects.toMatchObject({
    code: "room_closed",
  });
  expect(
    await getDb().select().from(roomDefinitions).where(eq(roomDefinitions.code, code)),
  ).toEqual([]);
});
