import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";

const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
const liveKit = vi.hoisted(() => ({ open: new Set<string>() as Set<string> | null }));
vi.mock("@/features/admin/live/server/livekit-rooms.server", () => ({
  liveKitRoomNames: async () => liveKit.open,
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const { closeGhostRoomAction } = await import("@/features/admin/live/actions.server");
const { listLiveRooms } = await import("@/features/admin/live/server/queries.server");
const { closeGhostRooms } = await import("@/features/admin/live/server/close-ghost.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const MINUTE = 60 * 1000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE);

async function liveRoom(code: string) {
  const [room] = await db
    .insert(schema.rooms)
    .values({ code, startedAt: ago(30), lastActivityAt: ago(10) })
    .returning();
  assert.ok(room);
  const [person] = await db
    .insert(schema.roomParticipations)
    .values({
      roomId: room.id,
      livekitIdentity: crypto.randomUUID(),
      livekitSid: `PA_${crypto.randomUUID()}`,
      displayName: "Ana",
      joinedAt: ago(20),
    })
    .returning();
  assert.ok(person);
  await db.insert(schema.roomParticipations).values({
    roomId: room.id,
    livekitIdentity: crypto.randomUUID(),
    livekitSid: `PA_${crypto.randomUUID()}`,
    displayName: "Saiu antes",
    joinedAt: ago(25),
    leftAt: ago(24),
  });
  await db.insert(schema.shareSessions).values({
    roomId: room.id,
    participationId: person.id,
    trackSid: `TR_${crypto.randomUUID()}`,
    startedAt: ago(15),
  });
  return { room, person };
}

describe("live rooms", () => {
  test("show who is in each live room and only whether someone shares", async () => {
    const { room } = await liveRoom("ao-vivo-lista");
    await db.insert(schema.rooms).values({ code: "ja-encerrada", status: "finished" });

    const rooms = await listLiveRooms(db);
    assert.deepEqual(
      rooms.map((live) => live.code),
      ["ao-vivo-lista"],
    );
    const [live] = rooms;
    assert.equal(live?.id, room.id);
    assert.equal(live?.sharing, true);
    assert.deepEqual(
      live?.people.map((person) => person.name),
      ["Ana"],
    );
  });
});

describe("the server's own ghost sweep", () => {
  // Far in the past, so the sweep only reaches this test's rooms (others run in parallel).
  const long = new Date("2001-01-01T12:00:00Z");
  const sweptAt = new Date("2001-01-01T13:00:00Z");

  async function quietRoom(code: string) {
    const [room] = await db
      .insert(schema.rooms)
      .values({ code, startedAt: long, lastActivityAt: long })
      .returning();
    assert.ok(room);
    const [person] = await db
      .insert(schema.roomParticipations)
      .values({
        roomId: room.id,
        livekitIdentity: crypto.randomUUID(),
        livekitSid: `PA_${crypto.randomUUID()}`,
        displayName: "Bia",
        joinedAt: long,
      })
      .returning();
    assert.ok(person);
    return { room, person };
  }

  test("ends rooms LiveKit dropped and lets their people go, without an admin", async () => {
    const ghost = await quietRoom("varrida-fantasma");
    const alive = await quietRoom("varrida-viva");

    const closed = await closeGhostRooms(db, new Set(["varrida-viva"]), sweptAt);
    assert.equal(closed, 1);

    const [ended] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, ghost.room.id));
    assert.equal(ended?.status, "finished");
    assert.equal(ended?.closedByAdminId, null);
    const [gone] = await db
      .select()
      .from(schema.roomParticipations)
      .where(eq(schema.roomParticipations.id, ghost.person.id));
    assert.equal(gone?.leaveReason, "unknown");
    assert.ok(gone?.leftAt);

    const [kept] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, alive.room.id));
    assert.equal(kept?.status, "active");
  });

  test("without an answer from LiveKit, nothing is a ghost", async () => {
    const { room } = await quietRoom("varrida-sem-livekit");
    assert.equal(await closeGhostRooms(db, null, sweptAt), 0);
    const [kept] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, room.id));
    assert.equal(kept?.status, "active");
  });
});

describe("closing a ghost room (live.close)", () => {
  let owner: Awaited<ReturnType<typeof adminSession>>;
  let viewer: Awaited<ReturnType<typeof adminSession>>;
  beforeAll(async () => {
    owner = await adminSession(db, "owner");
    viewer = await adminSession(db, "viewer");
  });

  test("ends the room, its people and shares at the last activity, audited", async () => {
    const { room, person } = await liveRoom("fantasma-1");
    liveKit.open = new Set(["outra-sala"]);
    requestHeaders.current = owner.headers;

    const result = await closeGhostRoomAction({ id: room.id });
    assert.deepEqual(result.data, { code: "fantasma-1" });

    const [closed] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, room.id));
    assert.equal(closed?.status, "finished");
    assert.equal(closed?.finishedAt?.getTime(), room.lastActivityAt.getTime());
    assert.equal(closed?.closedByAdminId, owner.id);

    const [left] = await db
      .select()
      .from(schema.roomParticipations)
      .where(eq(schema.roomParticipations.id, person.id));
    assert.equal(left?.leaveReason, "unknown");
    assert.equal(left?.leftAt?.getTime(), room.lastActivityAt.getTime());

    const shares = await db
      .select({ endedAt: schema.shareSessions.endedAt })
      .from(schema.shareSessions)
      .where(eq(schema.shareSessions.roomId, room.id));
    assert.ok(shares.every((share) => share.endedAt !== null));

    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, room.id));
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.action, "room.close_ghost");
    assert.deepEqual(audit[0]?.metadata, { codigo: "fantasma-1", pessoas: 1 });
  });

  test("refuses a room that is still open in LiveKit, or when LiveKit does not answer", async () => {
    const { room } = await liveRoom("ainda-aberta");
    requestHeaders.current = owner.headers;

    liveKit.open = new Set(["ainda-aberta"]);
    const open = await closeGhostRoomAction({ id: room.id });
    assert.match(open.serverError ?? "", /aberta no LiveKit/);

    liveKit.open = null;
    const unknown = await closeGhostRoomAction({ id: room.id });
    assert.match(unknown.serverError ?? "", /não respondeu/);

    const [still] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, room.id));
    assert.equal(still?.status, "active");
  });

  test("keeps a room open when an event landed after LiveKit was asked", async () => {
    const { room } = await liveRoom("atividade-agora");
    // A participant_joined projected meanwhile moves the last activity forward.
    await db
      .update(schema.rooms)
      .set({ lastActivityAt: new Date() })
      .where(eq(schema.rooms.id, room.id));
    liveKit.open = new Set();
    requestHeaders.current = owner.headers;

    const result = await closeGhostRoomAction({ id: room.id });
    assert.match(result.serverError ?? "", /atividade agora há pouco/);
    const [still] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, room.id));
    assert.equal(still?.status, "active");
  });

  test("a viewer can see live rooms but not close them", async () => {
    const { room } = await liveRoom("fantasma-viewer");
    liveKit.open = new Set();
    requestHeaders.current = viewer.headers;
    const result = await closeGhostRoomAction({ id: room.id });
    assert.equal(result.serverError, "Você não tem permissão para fazer isso.");
  });
});
