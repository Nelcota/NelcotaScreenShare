import { afterAll, beforeEach, expect, test } from "vitest";
import { closeDb, getDb } from "@/server/db/index.server";
import { workspaceRooms } from "@/features/rooms/server/queries.server";
import { beta, roomChange } from "./support/workspaces";
import { account, mockControlTransport } from "./support/host-controls";

/**
 * Lowering the Pro beta's room limit keeps the rooms already there, but nothing new goes
 * above it: neither a new room nor an archived one brought back.
 */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

const room = (name: string) =>
  ({ kind: "create", name, allowGuests: true, memberCanHost: false }) as const;

test("a lowered limit keeps existing rooms and blocks creating or unarchiving above it", async () => {
  const actor = await account();
  await beta(actor, "account", true, 3);
  const first = await roomChange(actor, room("Um"));
  await roomChange(actor, room("Dois"));
  await roomChange(actor, room("Três"));
  await roomChange(actor, { kind: "archive", roomId: first.roomId, archived: true });

  await beta(actor, "account", true, 1);
  expect(await workspaceRooms(getDb(), actor)).toHaveLength(3);
  await expect(roomChange(actor, room("Quatro"))).rejects.toThrow("limite de salas");
  await expect(
    roomChange(actor, { kind: "archive", roomId: first.roomId, archived: false }),
  ).rejects.toThrow("limite de salas");
});
