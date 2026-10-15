import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { staffByRoom } from "@/features/admin/rooms/server/room-staff.server";
import { listLiveRooms } from "@/features/admin/live/server/queries.server";
import { createRoom } from "@/features/room/server/room-codes.server";
import { saveRoomAccess } from "@/features/room/server/room-access.server";
import * as schema from "@/server/db/schema";

/** Owner, moderators and entry mode shown on the room page and in "Ao vivo". */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

async function account(name: string): Promise<string> {
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `equipe-${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

async function moderator(code: string, name: string): Promise<string> {
  const id = await account(name);
  await db.insert(schema.roomRoles).values({ roomCode: code, userId: id, role: "moderator" });
  return id;
}

test("owner, moderators in the order they were made and the entry mode", async () => {
  const ana = await account("Ana");
  const code = await createRoom(db, ana);
  const bruno = await moderator(code, "Bruno");
  const carla = await moderator(code, "Carla");
  await saveRoomAccess(db, { roomCode: code, access: "approval", userId: ana });

  const staff = (await staffByRoom(db, [code])).get(code);
  assert.deepEqual(staff, {
    owner: { id: ana, name: "Ana" },
    moderators: [
      { id: bruno, name: "Bruno" },
      { id: carla, name: "Carla" },
    ],
    access: "approval",
  });
});

test("a deleted moderator is hidden; without a saved choice the room is open", async () => {
  const ana = await account("Ana");
  const code = await createRoom(db, ana);
  const gone = await moderator(code, "Excluída");
  await db.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.id, gone));

  const staff = (await staffByRoom(db, [code])).get(code);
  assert.deepEqual(staff?.moderators, []);
  assert.equal(staff?.access, "open");
});

test("a room joined straight by the link has no staff", async () => {
  assert.equal((await staffByRoom(db, ["sala-sem-dono"])).size, 0);
  assert.equal((await staffByRoom(db, [])).size, 0);
});

test("Ao vivo shows the owner's name and the entry mode, only for created rooms", async () => {
  const ana = await account("Ana Dona");
  const code = await createRoom(db, ana);
  const plain = `sala-livre-${Date.now().toString(36)}`;
  await db.insert(schema.rooms).values([
    { code, startedAt: new Date() },
    { code: plain, startedAt: new Date() },
  ]);

  const live = await listLiveRooms(db);
  assert.deepEqual(live.find((room) => room.code === code)?.staff, {
    owner: "Ana Dona",
    access: "open",
  });
  assert.equal(live.find((room) => room.code === plain)?.staff, null);
});
