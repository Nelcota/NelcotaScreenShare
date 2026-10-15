import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { listCallRemovals, readmitToSession } from "@/features/room/server/call-removals.server";
import { createRoom } from "@/features/room/server/room-codes.server";
import * as schema from "@/server/db/schema";

/** Host controls off: bans from the panel's view live in room_bans for the LiveKit call. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const currentCall = { roomSid: async () => "RM_agora" };

async function account(name: string): Promise<string> {
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `remocao-${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

test("only bans from the call happening now are listed, with who banned", async () => {
  const ana = await account("Ana");
  const bia = await account("Bia");
  const code = await createRoom(db, ana);
  await db.insert(schema.roomBans).values([
    { roomCode: code, identity: bia, livekitRoomSid: "RM_agora", bannedByUserId: ana },
    { roomCode: code, identity: "convidado-x", livekitRoomSid: "RM_antes" },
  ]);
  const removals = await listCallRemovals(db, code, currentCall);
  assert.equal(removals.length, 1);
  assert.equal(removals[0]?.identity, bia);
  assert.equal(removals[0]?.userId, bia);
  assert.equal(removals[0]?.byUserId, ana);
  assert.deepEqual(await listCallRemovals(db, code, { roomSid: async () => undefined }), []);
});

test("lifting a ban deletes it for this call only", async () => {
  const ana = await account("Ana");
  const code = await createRoom(db, ana);
  await db.insert(schema.roomBans).values([
    { roomCode: code, identity: "convidado-y", livekitRoomSid: "RM_agora" },
    { roomCode: code, identity: "convidado-y", livekitRoomSid: "RM_antes" },
  ]);
  assert.deepEqual(
    await readmitToSession(db, { roomCode: code, identity: "convidado-y" }, currentCall),
    { ok: true },
  );
  assert.deepEqual(
    await readmitToSession(db, { roomCode: code, identity: "convidado-y" }, currentCall),
    { ok: false, reason: "not_removed" },
  );
  const left = await listCallRemovals(db, code, { roomSid: async () => "RM_antes" });
  assert.equal(left.length, 1);
  assert.deepEqual(
    await readmitToSession(
      db,
      { roomCode: code, identity: "convidado-y" },
      { roomSid: async () => undefined },
    ),
    { ok: false, reason: "no_call" },
  );
});
