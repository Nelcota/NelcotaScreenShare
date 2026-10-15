import { afterAll, beforeEach, expect, test } from "vitest";
import { closeDb, getDb } from "@/server/db/index.server";
import { listCallRemovals, readmitToSession } from "@/features/room/server/call-removals.server";
import { excludeFromSession } from "@/features/room/server/session-exclusion.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { controlledRoom, grant, mockControlTransport } from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

const noCall = { roomSid: async () => undefined };

test("the panel lists who was banned from the open session, and by whom", async () => {
  const room = await controlledRoom();
  expect(await listCallRemovals(getDb(), room.code, noCall)).toEqual([]);
  await excludeFromSession(getDb(), {
    roomCode: room.code,
    identity: room.other,
    by: { userId: room.host },
  });
  const removals = await listCallRemovals(getDb(), room.code, noCall);
  expect(removals).toEqual([
    expect.objectContaining({
      identity: room.other,
      userId: room.other,
      byUserId: room.host,
      byAdminId: null,
    }),
  ]);
});

test("lifting the ban lets the person in again; twice says it was not removed", async () => {
  const room = await controlledRoom();
  await excludeFromSession(getDb(), {
    roomCode: room.code,
    identity: room.other,
    by: { userId: room.host },
  });
  await expect(reserveAdmission(getDb(), grant(room.code, room.other), 6)).rejects.toMatchObject({
    code: "room_removed",
  });
  expect(await readmitToSession(getDb(), { roomCode: room.code, identity: room.other })).toEqual({
    ok: true,
  });
  await expect(reserveAdmission(getDb(), grant(room.code, room.other), 6)).resolves.toBeDefined();
  expect(await listCallRemovals(getDb(), room.code, noCall)).toEqual([]);
  expect(await readmitToSession(getDb(), { roomCode: room.code, identity: room.other })).toEqual({
    ok: false,
    reason: "not_removed",
  });
});

test("without an open call there is nobody to lift", async () => {
  expect(
    await readmitToSession(getDb(), { roomCode: "abc-defg-hij", identity: "convidado-1" }),
  ).toEqual({ ok: false, reason: "no_call" });
});
