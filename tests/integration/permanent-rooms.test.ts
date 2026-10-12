import { afterAll, beforeEach, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { roomDefinitions, roomSessions } from "@/server/db/schema/room-control";
import { auditLogs } from "@/server/db/schema/audit";
import { roomFavorites } from "@/server/db/schema/room-favorites";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { assertDefinitionAdmission } from "@/features/rooms/server/room-access.server";
import { authorizeSignal } from "@/features/room/server/signal-admission.server";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { sessionHistory, workspaceRooms } from "@/features/rooms/server/queries.server";
import { beta, personalRoom, roomChange, liveCall } from "./support/workspaces";
import { account, grant, mockControlTransport } from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

test("Pro creation and allowance cannot be bypassed, even by simultaneous requests", async () => {
  const actor = await account();
  const input = {
    kind: "create",
    name: "Recurring call",
    allowGuests: true,
    memberCanHost: false,
  } as const;
  await expect(roomChange(actor, input)).rejects.toThrow("Pro beta ativo");
  await beta(actor, "account", true, 1);
  const results = await Promise.allSettled([roomChange(actor, input), roomChange(actor, input)]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(await workspaceRooms(getDb(), actor)).toHaveLength(1);
  expect(
    await getDb().select().from(auditLogs).where(eq(auditLogs.action, "permanent_room.create")),
  ).toHaveLength(1);
});
test("closing a permanent call preserves the public code and creates a distinct next call", async () => {
  const { actor, room } = await personalRoom();
  const other = await account();
  await expect(reserveAdmission(getDb(), grant(room.code, other), 6)).rejects.toThrow("Só o dono");
  const call = await liveCall(room.code, actor, [other]);
  await expect(
    roomChange(actor, { kind: "archive", roomId: room.id, archived: true }),
  ).rejects.toThrow("Encerre a chamada");
  await call.command({ kind: "close" });
  const next = await reserveAdmission(getDb(), grant(room.code, actor), 6);
  expect(next.sessionId).not.toBe(call.sessionId);
  const [definition] = await getDb()
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, room.id));
  expect(definition?.closedAt).toBeNull();
  const history = await sessionHistory(getDb(), actor, room.id);
  expect(history.items).toHaveLength(2);
  expect(history.items.find((item) => item.id === call.sessionId)?.participants).toBe(2);
  expect(history.items[0]).not.toHaveProperty("ip");
});
test("archive and favorites preserve access checks; history remains readable without Pro", async () => {
  const { actor, room } = await personalRoom();
  const outsider = await account();
  await expect(
    roomChange(outsider, { kind: "favorite", roomId: room.id, favorite: true }),
  ).rejects.toThrow("não está disponível");
  await expect(sessionHistory(getDb(), outsider, room.id)).rejects.toThrow("não está disponível");
  await roomChange(actor, { kind: "favorite", roomId: room.id, favorite: true });
  await roomChange(actor, {
    kind: "edit",
    roomId: room.id,
    name: "Weekly meeting",
    allowGuests: false,
    memberCanHost: false,
  });
  expect((await workspaceRooms(getDb(), actor))[0]).toMatchObject({
    code: room.code,
    name: "Weekly meeting",
    favorite: true,
  });
  await roomChange(actor, { kind: "archive", roomId: room.id, archived: true });
  await expect(reserveAdmission(getDb(), grant(room.code, actor), 6)).rejects.toThrow("arquivada");
  await beta(actor, "account", false);
  await expect(
    roomChange(actor, { kind: "archive", roomId: room.id, archived: false }),
  ).rejects.toThrow("Pro beta ativo");
  expect((await sessionHistory(getDb(), actor, room.id)).items).toHaveLength(0);
  await roomChange(actor, { kind: "favorite", roomId: room.id, favorite: false });
  expect(
    await getDb().select().from(roomFavorites).where(eq(roomFavorites.roomId, room.id)),
  ).toHaveLength(0);
});
test("deactivation permits an active call to finish and prevents the next start", async () => {
  const { actor, room } = await personalRoom();
  const call = await liveCall(room.code, actor);
  await beta(actor, "account", false);
  await expect(assertDefinitionAdmission(getDb(), room, actor, false)).resolves.toBeUndefined();
  await call.command({ kind: "close" });
  await expect(reserveAdmission(getDb(), grant(room.code, actor), 6)).rejects.toThrow(
    "Pro beta está inativo",
  );
});

test("Pro revocation between reservation and connection refuses the unused credential", async () => {
  const { actor, room } = await personalRoom();
  const pending = await reserveAdmission(getDb(), grant(room.code, actor), 6);
  const credential = await liveKitGateway.signToken(grant(pending.mediaRoomName, actor));
  await beta(actor, "account", false);
  await expect(authorizeSignal(getDb(), credential)).rejects.toThrow("Pro beta está inativo");
});
test("history pagination stays scoped and stable for calls with equal timestamps", async () => {
  const { actor, room } = await personalRoom();
  const at = new Date();
  await getDb()
    .insert(roomSessions)
    .values(
      Array.from({ length: 55 }, () => ({
        definitionId: room.id,
        mediaRoomName: `nelcota-${crypto.randomUUID()}`,
        status: "closed" as const,
        startedAt: at,
        createdAt: at,
        closedAt: at,
        participantCount: 3,
      })),
    );
  const first = await sessionHistory(getDb(), actor, room.id);
  expect(first.items).toHaveLength(50);
  const second = await sessionHistory(getDb(), actor, room.id, first.next ?? undefined);
  expect(second.items).toHaveLength(5);
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(55);
  expect(
    await getDb()
      .select()
      .from(roomSessions)
      .where(and(eq(roomSessions.definitionId, room.id), eq(roomSessions.status, "closed"))),
  ).toHaveLength(55);
});
