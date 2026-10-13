import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** POST /api/sala/moderar end to end: real sessions and roles, LiveKit as an object literal. */
Object.assign(process.env, {
  LIVEKIT_URL: "ws://127.0.0.1:9",
  AUTH_SECRET: "segredo-participantes-de-teste-0123456789abcdef",
});

const { moderateRoom } = await import("@/features/room/server/moderation-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { newGuestSession } = await import("@/features/room/server/guest-session.server");
const { createRoom } = await import("@/features/room/server/room-codes.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

const GUEST = "convidado-4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10";
const CALL_SID = "RM_chamada-da-rota";
const removed: string[] = [];
const gateway = {
  countParticipants: () => Promise.resolve(1),
  hostPresent: () => Promise.resolve(true),
  signToken: () => Promise.resolve("token"),
  roomSid: () => Promise.resolve(CALL_SID),
  removeParticipant: (_room: string, identity: string) => {
    removed.push(identity);
    return Promise.resolve(true);
  },
  updateRole: () => Promise.resolve(true),
};

function post(
  body: unknown,
  { cookie, origin = "http://localhost:3000" }: { cookie?: string; origin?: string } = {},
) {
  const headers = new Headers({ "content-type": "application/json", origin });
  if (cookie) headers.set("cookie", cookie);
  return moderateRoom(
    new Request("http://localhost:3000/api/sala/moderar", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    gateway,
  );
}

/** A room whose owner and moderator are signed in. */
async function moderatedRoom() {
  const owner = await verifiedParticipant(db, handler, { name: "Ana Dona" });
  const moderator = await verifiedParticipant(db, handler, { name: "Bia Moderadora" });
  const room = await createRoom(db, owner.id);
  await db
    .insert(schema.roomRoles)
    .values({ roomCode: room, userId: moderator.id, role: "moderator", grantedByUserId: owner.id });
  return { room, owner, moderator };
}

describe("moderate the room", () => {
  it("the owner kicks: 204, removed in LiveKit and audited with the account", async () => {
    const { room, owner } = await moderatedRoom();
    const response = await post(
      { room, identity: GUEST, action: "kick" },
      { cookie: owner.jar.header() },
    );
    expect(response.status).toBe(204);
    expect(removed.at(-1)).toBe(GUEST);
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorUserId, owner.id));
    expect(audit).toMatchObject({ action: "room.participant_kick", resourceType: "room" });
    expect(audit?.metadata).toMatchObject({ sala: room, participante: GUEST, origem: "chamada" });
  });

  it("a moderator bans a guest from this call", async () => {
    const { room, moderator } = await moderatedRoom();
    const response = await post(
      { room, identity: GUEST, action: "ban" },
      { cookie: moderator.jar.header() },
    );
    expect(response.status).toBe(204);
    const bans = await db
      .select()
      .from(schema.roomBans)
      .where(and(eq(schema.roomBans.roomCode, room), eq(schema.roomBans.identity, GUEST)));
    expect(bans).toMatchObject([{ livekitRoomSid: CALL_SID, bannedByUserId: moderator.id }]);
  });

  it("a moderator cannot remove the owner: 403", async () => {
    const { room, owner, moderator } = await moderatedRoom();
    const response = await post(
      { room, identity: owner.id, action: "ban" },
      { cookie: moderator.jar.header() },
    );
    expect(response.status).toBe(403);
  });

  it("a guest gets 401 and a foreign origin 403", async () => {
    const { room, owner } = await moderatedRoom();
    const { setCookie } = await newGuestSession(new Request("http://localhost:3000/api/token"));
    const guest = await post(
      { room, identity: owner.id, action: "kick" },
      { cookie: setCookie.split(";")[0] },
    );
    expect(guest.status).toBe(401);
    const foreign = await post(
      { room, identity: GUEST, action: "kick" },
      { cookie: owner.jar.header(), origin: "https://outro-site.example" },
    );
    expect(foreign.status).toBe(403);
  });

  it("an invalid or oversized body gets 400", async () => {
    const { room, owner } = await moderatedRoom();
    const cookie = owner.jar.header();
    expect((await post("{not json", { cookie })).status).toBe(400);
    expect((await post({ room, identity: GUEST, action: "mute" }, { cookie })).status).toBe(400);
    const oversized = { room, identity: GUEST, action: "kick", padding: "x".repeat(20 * 1024) };
    expect((await post(oversized, { cookie })).status).toBe(400);
  });

  it("the attempt limit per account gets 429", async () => {
    const { room, owner } = await moderatedRoom();
    const cookie = owner.jar.header();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 31; attempt++) {
      statuses.push((await post({ room, identity: "", action: "kick" }, { cookie })).status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
