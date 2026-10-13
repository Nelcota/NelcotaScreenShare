import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { auditLogs } from "@/server/db/schema/audit";
import { verifiedParticipant } from "./support/accounts";
import { account, controlledRoom, grant, mockControlTransport } from "./support/host-controls";
import type * as LiveKitGatewayModule from "@/features/room/server/livekit-gateway.server";

/** Calling a friend: the ring, and getting in without waiting for approval. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

/** Who LiveKit has in each room: the participations alone may be left over from a crash. */
const connected = vi.hoisted(() => new Map<string, string[]>());
vi.mock("@/features/room/server/livekit-gateway.server", async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKitGatewayModule>()),
  identitiesIn: async (room: string) => connected.get(room) ?? [],
}));

const ringing = await import("@/features/ringing/actions.server");
const { incomingRings, outgoingRings } =
  await import("@/features/ringing/server/ring-service.server");
const { admitByRing } = await import("@/features/ringing/server/ring-admission.server");
const { createRoom } = await import("@/features/room/server/room-codes.server");
const { mediaRoomIn } = await import("@/features/room/server/session-store.server");
const { roomAccessOf, saveRoomAccess } = await import("@/features/room/server/room-access.server");
const rooms = await import("@/features/room/actions.server");
const { consumeApproval } = await import("@/features/room/server/join-requests.server");
const { reserveAdmission } = await import("@/features/room/server/session-admission.server");
const { markOnline } = await import("@/features/friends/server/online-presence.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { getDb } = await import("@/server/db/index.server");
const { createGroup } = await import("@/features/messages/server/conversations.server");
const { liveGroupCall, groupCallLines } =
  await import("@/features/ringing/server/group-calls.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

async function friends(one: string, other: string) {
  const [low, high] = [one, other].toSorted();
  if (!low || !high) throw new Error("two people");
  await db.insert(schema.friendships).values({
    userLowId: low,
    userHighId: high,
    requestedBy: low,
    status: "accepted",
    acceptedAt: new Date(),
  });
}

/** The webhook's record of someone in a call, still open. */
async function inCall(userId: string, code: string) {
  const [room] = await db.insert(schema.rooms).values({ code }).returning();
  if (!room) throw new Error("room not saved");
  await db.insert(schema.roomParticipations).values({
    roomId: room.id,
    userId,
    livekitIdentity: userId,
    livekitSid: `PA_${crypto.randomUUID()}`,
    joinedAt: new Date(),
  });
}

describe("calling a friend", () => {
  test("rings an online friend, who gets into a room that asks for approval", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await friends(ana.id, bia.id);
    markOnline(bia.id);
    const code = await createRoom(db, ana.id);
    await saveRoomAccess(db, { roomCode: code, access: "approval", userId: ana.id });

    as(ana);
    const called = await ringing.callFriend({ friendId: bia.id, room: code });
    const ringId = called.data?.ringId ?? "";
    expect(incomingRings(bia.id).map((ring) => ring.id)).toEqual([ringId]);

    as(bia);
    expect((await ringing.acceptCall({ ringId })).data?.path).toBe(`/sala/${code}?atendeu=1`);
    expect(outgoingRings(ana.id)).toEqual([]);
    const approval = await consumeApproval(db, {
      roomCode: code,
      requester: { userId: bia.id },
      requestId: undefined,
    });
    expect(approval).not.toBeNull();
    const audit = await db
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "room.ring_admit"), eq(auditLogs.resourceId, code)));
    expect(audit[0]?.metadata).toMatchObject({ decidedBy: ana.id });
  });

  test("outside a call, the page is told to open a room first", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await friends(ana.id, bia.id);
    markOnline(bia.id);
    as(ana);
    expect((await ringing.callFriend({ friendId: bia.id })).data).toEqual({
      ringId: null,
      needsRoom: true,
    });
    expect(incomingRings(bia.id)).toEqual([]);
  });

  test("without a room, rings into the call LiveKit still has you in", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await friends(ana.id, bia.id);
    markOnline(bia.id);
    const code = await createRoom(db, ana.id);
    await inCall(ana.id, code);
    connected.set(code, [ana.id]);

    as(ana);
    const called = await ringing.callFriend({ friendId: bia.id });
    expect(called.data?.needsRoom).toBe(false);
    expect(incomingRings(bia.id).map((ring) => ring.roomCode)).toEqual([code]);
  });

  test("a call LiveKit dropped without telling does not ring anyone into it", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await friends(ana.id, bia.id);
    markOnline(bia.id);
    // Open in the database, but LiveKit restarted and no longer has her.
    await inCall(ana.id, await createRoom(db, ana.id));

    as(ana);
    expect((await ringing.callFriend({ friendId: bia.id })).data).toEqual({
      ringId: null,
      needsRoom: true,
    });
    expect(incomingRings(bia.id)).toEqual([]);
  });

  test("the room Chamar opens asks for approval, and the friend rung goes straight in", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await friends(ana.id, bia.id);
    markOnline(bia.id);
    as(ana);
    const created = await rooms.createRoomAction({ access: "approval" });
    const code = created.data?.path.split("/").at(-1) ?? "";
    expect(await roomAccessOf(db, code)).toBe("approval");
    const ringId = (await ringing.callFriend({ friendId: bia.id, room: code })).data?.ringId ?? "";

    as(bia);
    expect((await ringing.acceptCall({ ringId })).data?.path).toContain(code);
    const approval = await consumeApproval(db, {
      roomCode: code,
      requester: { userId: bia.id },
      requestId: undefined,
    });
    expect(approval).not.toBeNull();
  });

  test("nobody rings an offline friend, a stranger, or into someone else's room", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    await friends(ana.id, bia.id);
    const anaRoom = await createRoom(db, ana.id);
    const caioRoom = await createRoom(db, caio.id);

    as(ana);
    expect((await ringing.callFriend({ friendId: bia.id, room: anaRoom })).serverError).toBe(
      "Não dá para chamar agora.",
    );
    markOnline(bia.id);
    markOnline(caio.id);
    expect((await ringing.callFriend({ friendId: caio.id, room: anaRoom })).serverError).toBe(
      "Não dá para chamar agora.",
    );
    expect((await ringing.callFriend({ friendId: bia.id, room: caioRoom })).serverError).toBe(
      "Não dá para chamar agora.",
    );
  });

  test("rings from someone else's room as soon as LiveKit has the caller, before the webhook", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    await friends(ana.id, bia.id);
    markOnline(bia.id);
    const caioRoom = await createRoom(db, caio.id);
    connected.set(await mediaRoomIn(db, caioRoom), [caio.id, ana.id]);

    as(ana);
    const called = await ringing.callFriend({ friendId: bia.id, room: caioRoom });
    expect(incomingRings(bia.id).map((ring) => ring.id)).toEqual([called.data?.ringId]);
  });
});

describe("calling a group", () => {
  test("rings every member who can take a call and records the call", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    const conversationId = await createGroup(db, ana.id, [bia.id, caio.id], "Noite do filme");
    markOnline(bia.id);
    const code = await createRoom(db, ana.id);

    as(ana);
    expect((await ringing.callGroup({ conversationId, room: code })).data).toEqual({
      rang: 1,
      needsRoom: false,
    });
    expect(incomingRings(bia.id)).toHaveLength(1);
    expect(incomingRings(caio.id)).toHaveLength(0);
    const lines = await groupCallLines(db, conversationId, new Date(0));
    expect(lines.map((line) => line.starterName)).toEqual(["Ana"]);
    expect(await liveGroupCall(db, conversationId)).toBeNull();

    as(caio);
    expect(
      (await ringing.callGroup({ conversationId: crypto.randomUUID(), room: code })).serverError,
    ).toBe("Não dá para chamar agora.");
  });
});

describe("ringing and the host's lock", () => {
  beforeEach(() => {
    process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
    mockControlTransport();
  });

  test("a ring lets someone skip the approval, never the lock", async () => {
    const room = await controlledRoom();
    const callee = await account();
    await saveRoomAccess(getDb(), { roomCode: room.code, access: "approval", userId: room.host });
    expect(
      await admitByRing(
        getDb(),
        { roomCode: room.code, callerId: room.host },
        {
          id: callee,
          name: "Pessoa",
        },
      ),
    ).not.toBeNull();
    await room.command({ kind: "lock", locked: true });
    await expect(reserveAdmission(getDb(), grant(room.code, callee), 6)).rejects.toMatchObject({
      code: "room_locked",
    });
  });
});
