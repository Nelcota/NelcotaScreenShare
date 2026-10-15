import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, test } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Moderators and handing the room over, in the database and through POST /api/sala/papel. */
Object.assign(process.env, {
  LIVEKIT_URL: "ws://127.0.0.1:9",
  AUTH_SECRET: "segredo-participantes-de-teste-0123456789abcdef",
});

const { applyRoleChange, roomOwnerName } =
  await import("@/features/room/server/role-changes.server");
const { roomRoleOf } = await import("@/features/room/server/room-roles.server");
const { createRoom } = await import("@/features/room/server/room-codes.server");
const { changeRoomRole } = await import("@/features/room/server/role-change-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

let counter = 0;
async function account(name: string): Promise<string> {
  counter += 1;
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `papel-${counter}-${Date.now()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

const roleIn = (roomCode: string, userId: string) => roomRoleOf(db, { roomCode, userId });

describe("role changes", () => {
  test("the owner makes and unmakes a moderator; repeating either is refused", async () => {
    const ana = await account("Ana");
    const bia = await account("Bia");
    const room = await createRoom(db, ana);
    const change = (kind: "promote" | "demote") =>
      applyRoleChange(db, { roomCode: room, actorUserId: ana, targetUserId: bia, change: kind });

    assert.deepEqual(await change("promote"), {
      ok: true,
      changed: [{ userId: bia, role: "moderator" }],
    });
    assert.equal(await roleIn(room, bia), "moderator");
    assert.deepEqual(await change("promote"), { ok: false, error: "already" });
    assert.deepEqual(await change("demote"), {
      ok: true,
      changed: [{ userId: bia, role: "participant" }],
    });
    assert.equal(await roleIn(room, bia), "participant");
    assert.deepEqual(await change("demote"), { ok: false, error: "not_moderator" });
  });

  test("a moderator cannot change roles, and nobody changes their own", async () => {
    const ana = await account("Ana");
    const bia = await account("Bia");
    const caio = await account("Caio");
    const room = await createRoom(db, ana);
    await applyRoleChange(db, {
      roomCode: room,
      actorUserId: ana,
      targetUserId: bia,
      change: "promote",
    });
    const byModerator = await applyRoleChange(db, {
      roomCode: room,
      actorUserId: bia,
      targetUserId: caio,
      change: "promote",
    });
    assert.deepEqual(byModerator, { ok: false, error: "not_owner" });
    const onSelf = await applyRoleChange(db, {
      roomCode: room,
      actorUserId: ana,
      targetUserId: ana,
      change: "transfer",
    });
    assert.deepEqual(onSelf, { ok: false, error: "self" });
  });

  test("handing the room over: one owner, the old one stays as moderator, the name follows", async () => {
    const ana = await account("Ana");
    const bia = await account("Bia");
    const room = await createRoom(db, ana);
    assert.equal(await roomOwnerName(db, room), "Ana");

    const result = await applyRoleChange(db, {
      roomCode: room,
      actorUserId: ana,
      targetUserId: bia,
      change: "transfer",
    });
    assert.deepEqual(result, {
      ok: true,
      changed: [
        { userId: bia, role: "owner" },
        { userId: ana, role: "moderator" },
      ],
    });
    assert.equal(await roleIn(room, bia), "owner");
    assert.equal(await roleIn(room, ana), "moderator");
    assert.equal(await roomOwnerName(db, room), "Bia");
    const owners = await db
      .select()
      .from(schema.roomRoles)
      .where(and(eq(schema.roomRoles.roomCode, room), eq(schema.roomRoles.role, "owner")));
    assert.equal(owners.length, 1);
    const [definition] = await db
      .select({ owner: schema.roomDefinitions.ownerUserId })
      .from(schema.roomDefinitions)
      .where(eq(schema.roomDefinitions.code, room));
    assert.equal(definition?.owner, bia);
  });

  test("a moderator handed the room becomes its owner", async () => {
    const ana = await account("Ana");
    const bia = await account("Bia");
    const room = await createRoom(db, ana);
    await applyRoleChange(db, {
      roomCode: room,
      actorUserId: ana,
      targetUserId: bia,
      change: "promote",
    });
    const result = await applyRoleChange(db, {
      roomCode: room,
      actorUserId: ana,
      targetUserId: bia,
      change: "transfer",
    });
    assert.equal(result.ok, true);
    assert.equal(await roleIn(room, bia), "owner");
    assert.equal(await roleIn(room, ana), "moderator");
  });

  test("an id that is not an account gets no role", async () => {
    const ana = await account("Ana");
    const room = await createRoom(db, ana);
    const result = await applyRoleChange(db, {
      roomCode: room,
      actorUserId: ana,
      targetUserId: crypto.randomUUID(),
      change: "promote",
    });
    assert.deepEqual(result, { ok: false, error: "no_account" });
  });
});

/** POST /api/sala/papel with a LiveKit that records the roles it is told to show. */
function post(
  body: unknown,
  { cookie, origin = "http://localhost:3000" }: { cookie?: string; origin?: string },
) {
  const headers = new Headers({ "content-type": "application/json", origin });
  if (cookie) headers.set("cookie", cookie);
  const updated: string[] = [];
  const gateway = {
    updateRole: (_room: string, identity: string, role: string) => {
      updated.push(`${identity}:${role}`);
      return Promise.resolve(true);
    },
  };
  const request = new Request("http://localhost:3000/api/sala/papel", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response: changeRoomRole(request, gateway), updated };
}

describe("POST /api/sala/papel", () => {
  test("the owner hands the room over: 200, shown in the call and audited", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana Dona" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia Nova" });
    const room = await createRoom(db, ana.id);
    const { response, updated } = post(
      { room, userId: bia.id, change: "transfer" },
      { cookie: ana.jar.header() },
    );
    assert.equal((await response).status, 200);
    assert.deepEqual(updated, [`${bia.id}:owner`, `${ana.id}:moderator`]);
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorUserId, ana.id));
    assert.equal(audit?.action, "room.owner_transfer");
  });

  test("a guest gets 401, another site 403, someone who is not the owner 403", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana Dona" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia Outra" });
    const room = await createRoom(db, ana.id);
    const body = { room, userId: bia.id, change: "promote" };
    assert.equal((await post(body, {}).response).status, 401);
    const foreign = post(body, { cookie: ana.jar.header(), origin: "https://outro.example" });
    assert.equal((await foreign.response).status, 403);
    const notOwner = post({ ...body, userId: ana.id }, { cookie: bia.jar.header() });
    assert.equal((await notOwner.response).status, 403);
    const invalid = post(
      { room, userId: "convidado-x", change: "promote" },
      { cookie: ana.jar.header() },
    );
    assert.equal((await invalid.response).status, 400);
  });
});
