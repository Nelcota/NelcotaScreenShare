import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import {
  roomCommands,
  roomDefinitions,
  roomSessionMembers,
  roomSessions,
} from "@/server/db/schema/room-control";
import { auditLogs } from "@/server/db/schema/audit";
import { roomParticipations, roomRoles, rooms, shareSessions } from "@/server/db/schema";
import { applyRoleChange } from "@/features/room/server/role-changes.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { controlGateway } from "@/features/room/server/control-gateway.server";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";
import {
  authorizeSignal,
  openSignal,
  validateSignal,
} from "@/features/room/server/signal-admission.server";
import {
  applyRoomCommand,
  retryRoomCommands,
} from "@/features/room/server/control-commands.server";
import { reconcileSessionPresence } from "@/features/room/server/session-presence.server";
import { readControlState } from "@/features/room/server/control-state.server";
import { maintainRoomControls } from "@/features/room/server/control-maintenance.server";
import {
  account,
  controlledRoom,
  grant,
  mockControlTransport,
  online,
  participant,
} from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

test("signaling refuses forged credentials and foreign origins before admission", async () => {
  const invalid = await openSignal(
    new Request("http://localhost:3000/api/sala/conexao/rtc?access_token=forged"),
  );
  expect(invalid).toBeInstanceOf(Response);
  if (!(invalid instanceof Response)) throw new Error("Forged token was admitted");
  expect(invalid.status).toBe(403);
  const foreign = await validateSignal(
    new Request("http://localhost:3000/api/sala/conexao/rtc/validate?access_token=forged", {
      headers: { origin: "https://foreign.example" },
    }),
  );
  expect(foreign.status).toBe(403);
});

test("concurrent host claims and capacity reservations have a single winner", async () => {
  const identities = await Promise.all([account(), account(), account()]);
  const code = "simultaneous-hosts";
  await getDb().insert(roomDefinitions).values({ code });
  const results = await Promise.allSettled(
    identities.map((identity) => reserveAdmission(getDb(), grant(code, identity), 2)),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  const sessions = await getDb().select().from(roomSessions);
  expect(sessions).toHaveLength(1);
  expect(identities).toContain(sessions[0]?.hostUserId);
  expect(await getDb().select().from(roomSessionMembers)).toHaveLength(2);
});

test("guest cannot claim host and token reservation is not admission", async () => {
  await getDb().insert(roomDefinitions).values({ code: "guest-no-host" });
  await expect(
    reserveAdmission(getDb(), grant("guest-no-host", "convidado-test"), 6),
  ).rejects.toMatchObject({ code: "host_absent" });
  const room = await controlledRoom();
  const waiting = await account();
  await reserveAdmission(getDb(), grant(room.code, waiting), 6);
  const oldToken = await liveKitGateway.signToken(grant(room.mediaRoomName, waiting));
  await room.command({ kind: "lock", locked: true });
  await expect(authorizeSignal(getDb(), oldToken)).rejects.toMatchObject({ code: "room_locked" });
  await expect(reserveAdmission(getDb(), grant(room.code, waiting), 6)).rejects.toMatchObject({
    code: "room_locked",
  });
  const admittedToken = await liveKitGateway.signToken(grant(room.mediaRoomName, room.other));
  await expect(authorizeSignal(getDb(), admittedToken)).resolves.toBeUndefined();
});

test("non-host, wrong room and guest transfers are refused under the authority lock", async () => {
  const room = await controlledRoom();
  await expect(room.command({ kind: "close" }, room.other)).rejects.toThrow("Só o anfitrião");
  await expect(room.command({ kind: "transfer", identity: "convidado-test" })).rejects.toThrow(
    "outra pessoa com conta",
  );
  await expect(room.command({ kind: "remove", identity: room.host })).rejects.toThrow("Para sair");
  await room.command({ kind: "transfer", identity: room.other });
  await expect(room.command({ kind: "lock", locked: true })).rejects.toThrow("Só o anfitrião");
  expect((await readControlState(getDb(), room.code, room.sessionId, room.other))?.isHost).toBe(
    true,
  );
  expect(
    await readControlState(getDb(), "different-room", room.sessionId, room.other),
  ).toBeUndefined();
});

test("original and server-refreshed credentials cannot bypass exclusion or closure", async () => {
  const room = await controlledRoom();
  const oldToken = await liveKitGateway.signToken(grant(room.mediaRoomName, room.other));
  const refreshedToken = await liveKitGateway.signToken(grant(room.mediaRoomName, room.other));
  await room.command({ kind: "remove", identity: room.other });
  for (const token of [oldToken, refreshedToken])
    await expect(authorizeSignal(getDb(), token)).rejects.toMatchObject({ code: "room_removed" });
  await expect(reserveAdmission(getDb(), grant(room.code, room.other), 6)).rejects.toMatchObject({
    code: "room_removed",
  });
  const hostToken = await liveKitGateway.signToken(grant(room.mediaRoomName, room.host));
  await room.command({ kind: "close" });
  await expect(authorizeSignal(getDb(), hostToken)).rejects.toMatchObject({ code: "room_closed" });
  await expect(reserveAdmission(getDb(), grant(room.code, room.host), 6)).rejects.toMatchObject({
    code: "room_closed",
  });
});

test("a retry that throws does not hold up the other rooms' commands", async () => {
  const first = await controlledRoom();
  const second = await controlledRoom();
  vi.spyOn(controlGateway, "sync")
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockRejectedValueOnce(new Error("unavailable"));
  const stuck = await first.command({ kind: "sharing", policy: "host", allowed: [] });
  const waiting = await second.command({ kind: "sharing", policy: "host", allowed: [] });
  expect([stuck.status, waiting.status]).toEqual(["failed", "failed"]);
  const db = getDb();
  // The first command in line breaks before its own transport step (a lock timeout, say).
  vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("lock timeout"));
  await retryRoomCommands(db, new Date(Date.now() + 120_000));
  const [stored] = await db
    .select()
    .from(roomCommands)
    .where(eq(roomCommands.id, waiting.commandId));
  expect(stored?.status).toBe("applied");
});

test("old broad grants are rewritten to the current sharing policy on reconnect", async () => {
  const room = await controlledRoom();
  const token = await liveKitGateway.signToken(grant(room.mediaRoomName, room.other));
  await room.command({ kind: "sharing", policy: "host", allowed: [] });
  const signer = vi.spyOn(liveKitGateway, "signToken");
  await authorizeSignal(getDb(), token);
  expect(signer).toHaveBeenLastCalledWith(
    expect.objectContaining({ identity: room.other, canShare: false }),
  );
  await room.command({ kind: "sharing", policy: "selected", allowed: [room.other] });
  await authorizeSignal(getDb(), token);
  expect(signer).toHaveBeenLastCalledWith(expect.objectContaining({ canShare: true }));
});

test("transport failure preserves policy/audit and retry applies current state", async () => {
  const room = await controlledRoom();
  const sync = vi.spyOn(controlGateway, "sync").mockRejectedValueOnce(new Error("unavailable"));
  const failed = await room.command({ kind: "sharing", policy: "host", allowed: [] });
  expect(failed.status).toBe("failed");
  expect((await readControlState(getDb(), room.code, room.sessionId, room.other))?.canShare).toBe(
    false,
  );
  expect(
    await getDb()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, room.sessionId), eq(auditLogs.action, "room.sharing"))),
  ).toHaveLength(1);
  await room.command({ kind: "sharing", policy: "everyone", allowed: [] });
  expect(await applyRoomCommand(getDb(), failed.commandId)).toBe("applied");
  expect(sync).toHaveBeenLastCalledWith(
    expect.objectContaining({ sharePolicy: "everyone" }),
    expect.any(Map),
  );
  const [stored] = await getDb()
    .select()
    .from(roomCommands)
    .where(eq(roomCommands.id, failed.commandId));
  expect(stored?.attempts).toBe(2);
  vi.spyOn(controlGateway, "sync").mockRejectedValueOnce(new Error("unavailable again"));
  const retried = await room.command({ kind: "lock", locked: true });
  expect(retried.status).toBe("failed");
  await maintainRoomControls(getDb(), new Date(Date.now() + 6_000));
  const [applied] = await getDb()
    .select()
    .from(roomCommands)
    .where(eq(roomCommands.id, retried.commandId));
  expect(applied?.status).toBe("applied");
});

test("one room failing in maintenance does not hold up the others", async () => {
  const broken = await controlledRoom();
  const room = await controlledRoom();
  vi.spyOn(controlGateway, "sync").mockRejectedValueOnce(new Error("unavailable"));
  const failed = await room.command({ kind: "lock", locked: true });
  expect(failed.status).toBe("failed");
  vi.spyOn(controlGateway, "participants").mockImplementation(async (media) => {
    if (media === broken.mediaRoomName) throw new Error("LiveKit down for this room");
    return online.get(media) ?? [];
  });
  await expect(
    maintainRoomControls(getDb(), new Date(Date.now() + 6_000)),
  ).resolves.toBeUndefined();
  const [applied] = await getDb()
    .select()
    .from(roomCommands)
    .where(eq(roomCommands.id, failed.commandId));
  expect(applied?.status).toBe("applied");
});

test("host absence respects grace and elects oldest admitted active account", async () => {
  const room = await controlledRoom();
  const db = getDb();
  const [initial] = await db.select().from(roomSessions).where(eq(roomSessions.id, room.sessionId));
  if (!initial) throw new Error("Missing session");
  const now = new Date();
  const people = [participant("convidado-older", 0), participant(room.other, 2)];
  const waiting = await db.transaction((tx) => reconcileSessionPresence(tx, initial, people, now));
  expect(waiting.hostUserId).toBe(room.host);
  const elected = await db.transaction((tx) =>
    reconcileSessionPresence(tx, waiting, people, new Date(now.getTime() + 60_001)),
  );
  expect(elected.hostUserId).toBe(room.other);
  online.set(room.mediaRoomName, people);
});

test("empty call expires without making definition terminal; old JWT cannot open next session", async () => {
  const room = await controlledRoom();
  const db = getDb();
  const [initial] = await db.select().from(roomSessions).where(eq(roomSessions.id, room.sessionId));
  if (!initial) throw new Error("Missing session");
  const now = new Date();
  // Someone LiveKit dropped without a participant_left: still "in the call" with a share.
  const [record] = await db.insert(rooms).values({ code: room.code }).returning();
  if (!record) throw new Error("Missing room");
  const [left] = await db
    .insert(roomParticipations)
    .values({
      roomId: record.id,
      sessionId: room.sessionId,
      livekitIdentity: room.other,
      livekitSid: `PA_${crypto.randomUUID()}`,
      joinedAt: new Date(now.getTime() - 60_000),
    })
    .returning();
  if (!left) throw new Error("Missing participation");
  await db.insert(shareSessions).values({
    roomId: record.id,
    participationId: left.id,
    trackSid: `TR_${crypto.randomUUID()}`,
    startedAt: new Date(now.getTime() - 30_000),
  });
  const waiting = await db.transaction((tx) => reconcileSessionPresence(tx, initial, [], now));
  const closed = await db.transaction((tx) =>
    reconcileSessionPresence(tx, waiting, [], new Date(now.getTime() + 60_001)),
  );
  expect(closed.status).toBe("closed");
  const [gone] = await db
    .select()
    .from(roomParticipations)
    .where(eq(roomParticipations.id, left.id));
  expect(gone?.leaveReason).toBe("unknown");
  expect(gone?.leftAt).not.toBeNull();
  const shares = await db
    .select({ endedAt: shareSessions.endedAt })
    .from(shareSessions)
    .where(eq(shareSessions.participationId, left.id));
  expect(shares.every((share) => share.endedAt !== null)).toBe(true);
  const token = await liveKitGateway.signToken(grant(room.mediaRoomName, room.host));
  await expect(authorizeSignal(db, token)).rejects.toMatchObject({ code: "room_closed" });
  const [definition] = await db
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, closed.definitionId));
  expect(definition?.closedAt).toBeNull();
  const next = await reserveAdmission(db, grant(room.code, room.host), 6);
  expect(next.sessionId).not.toBe(room.sessionId);
  expect(next.mediaRoomName).not.toBe(room.mediaRoomName);
});

/** A third account admitted to the call, for co-host cases. */
async function admittedThird(room: Awaited<ReturnType<typeof controlledRoom>>, joinedAt = 3) {
  const third = await account();
  await reserveAdmission(getDb(), grant(room.code, third), 6);
  await getDb()
    .update(roomSessionMembers)
    .set({ admittedAt: new Date() })
    .where(eq(roomSessionMembers.sessionId, room.sessionId));
  online.set(room.mediaRoomName, [
    ...(online.get(room.mediaRoomName) ?? []),
    participant(third, joinedAt),
  ]);
  return third;
}

async function saveRole(code: string, userId: string, role: "owner" | "moderator") {
  await getDb().insert(roomRoles).values({ roomCode: code, userId, role });
}

test("a moderator co-hosts: lock, sharing and removal of participants, not transfer or close", async () => {
  const room = await controlledRoom();
  const third = await admittedThird(room);
  await saveRole(room.code, room.other, "moderator");
  expect(
    (await readControlState(getDb(), room.code, room.sessionId, room.other))?.commands,
  ).toEqual(["lock", "sharing", "remove"]);
  await expect(room.command({ kind: "lock", locked: true }, room.other)).resolves.toMatchObject({
    status: "applied",
  });
  await expect(room.command({ kind: "close" }, room.other)).rejects.toThrow(
    "Só o anfitrião ou o dono",
  );
  await expect(room.command({ kind: "transfer", identity: third }, room.other)).rejects.toThrow(
    "Só o anfitrião ou o dono",
  );
  await expect(room.command({ kind: "remove", identity: room.host }, room.other)).rejects.toThrow(
    "Moderadores só removem participantes",
  );
  await expect(
    room.command({ kind: "remove", identity: third }, room.other),
  ).resolves.toMatchObject({ status: "applied" });
});

test("a host who is not the owner cannot remove the owner, back from a reconnect", async () => {
  const room = await controlledRoom();
  await saveRole(room.code, room.other, "owner");
  // The owner is reconnecting: admitted to the session, but not in LiveKit right now.
  online.set(room.mediaRoomName, [participant(room.host)]);
  await expect(room.command({ kind: "remove", identity: room.other })).rejects.toThrow(
    "Ninguém remove o dono da sala",
  );
  const [owner] = await getDb()
    .select({ excludedAt: roomSessionMembers.excludedAt })
    .from(roomSessionMembers)
    .where(
      and(
        eq(roomSessionMembers.sessionId, room.sessionId),
        eq(roomSessionMembers.identity, room.other),
      ),
    );
  expect(owner?.excludedAt).toBeNull();
});

test("host absence elects a moderator before an older account", async () => {
  const room = await controlledRoom();
  const third = await admittedThird(room, 0);
  await saveRole(room.code, room.other, "moderator");
  const db = getDb();
  const [initial] = await db.select().from(roomSessions).where(eq(roomSessions.id, room.sessionId));
  if (!initial) throw new Error("Missing session");
  const now = new Date();
  const people = [participant(third, 0), participant(room.other, 2)];
  const waiting = await db.transaction((tx) => reconcileSessionPresence(tx, initial, people, now));
  const elected = await db.transaction((tx) =>
    reconcileSessionPresence(tx, waiting, people, new Date(now.getTime() + 60_001)),
  );
  expect(elected.hostUserId).toBe(room.other);
});

test("the owner takes the host over once in the call", async () => {
  const room = await controlledRoom();
  await saveRole(room.code, room.other, "owner");
  const db = getDb();
  const [initial] = await db.select().from(roomSessions).where(eq(roomSessions.id, room.sessionId));
  if (!initial) throw new Error("Missing session");
  const people = [participant(room.host, 1), participant(room.other, 2)];
  const updated = await db.transaction((tx) =>
    reconcileSessionPresence(tx, initial, people, new Date()),
  );
  expect(updated.hostUserId).toBe(room.other);
  const [audit] = await db
    .select()
    .from(auditLogs)
    .where(
      and(eq(auditLogs.resourceId, room.sessionId), eq(auditLogs.action, "room.host_transfer")),
    );
  expect(audit?.metadata).toMatchObject({ motivo: "owner_present", anfitriao: room.other });
});

test("closing a room with an owner ends only the call; the code opens a new one", async () => {
  const room = await controlledRoom();
  await saveRole(room.code, room.host, "owner");
  expect((await readControlState(getDb(), room.code, room.sessionId, room.host))?.endsRoom).toBe(
    false,
  );
  await room.command({ kind: "close" });
  const [definition] = await getDb()
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.code, room.code));
  expect(definition?.closedAt).toBeNull();
  const next = await reserveAdmission(getDb(), grant(room.code, room.host), 6);
  expect(next.sessionId).not.toBe(room.sessionId);
});

test("the owner's host transfer hands over the room, and the host does not bounce back", async () => {
  const room = await controlledRoom();
  await saveRole(room.code, room.host, "owner");
  await room.command({ kind: "transfer", identity: room.other });
  const roles = await getDb().select().from(roomRoles).where(eq(roomRoles.roomCode, room.code));
  expect(new Map(roles.map((row) => [row.userId, row.role]))).toEqual(
    new Map([
      [room.other, "owner"],
      [room.host, "moderator"],
    ]),
  );
  const [definition] = await getDb()
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.code, room.code));
  expect(definition?.ownerUserId).toBe(room.other);
  const state = await readControlState(getDb(), room.code, room.sessionId, room.host);
  expect(state?.isHost).toBe(false);
  expect(state?.commands).toEqual(["lock", "sharing", "remove"]);
});

test("after the owner hands the room over from the card, the new owner becomes host", async () => {
  const room = await controlledRoom();
  await saveRole(room.code, room.host, "owner");
  await applyRoleChange(getDb(), {
    roomCode: room.code,
    actorUserId: room.host,
    targetUserId: room.other,
    change: "transfer",
  });
  expect((await readControlState(getDb(), room.code, room.sessionId, room.other))?.isHost).toBe(
    true,
  );
});
