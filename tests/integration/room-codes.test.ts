import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { createRoom, roomExists } from "@/features/room/server/room-codes.server";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import * as schema from "@/server/db/schema";

/** Rooms exist only once created; the creator owns them. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

let counter = 0;

async function account(name: string): Promise<string> {
  counter += 1;
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `sala${counter}-${Date.now()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

test("the account that creates a room owns it; other accounts are participants", async () => {
  const ana = await account("Ana");
  const bia = await account("Bia");
  const code = await createRoom(db, ana);
  assert.match(code, /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/);
  assert.equal(await roomExists(db, code), true);
  assert.equal(await roomRoleOf(db, { roomCode: code, userId: ana }), "owner");
  assert.equal(await roomRoleOf(db, { roomCode: code, userId: bia }), "participant");
  assert.notEqual(await createRoom(db, ana), code);
});

test("a valid code that nobody created does not exist", async () => {
  assert.equal(await roomExists(db, "bzk-i123-askjndjkaw"), false);
});

test("a deleted owner leaves the room open, without an owner", async () => {
  const ana = await account("Ana");
  const code = await createRoom(db, ana);
  await db.delete(schema.users).where(eq(schema.users.id, ana));
  assert.equal(await roomExists(db, code), true);
  const owners = await db
    .select()
    .from(schema.roomRoles)
    .where(eq(schema.roomRoles.roomCode, code));
  assert.equal(owners.length, 0);
});

/** The handwritten part of migration 0021, which moves the "Criar sala" codes over. */
function registryStatement(): string {
  const migration = readFileSync("drizzle/0021_room_registry.sql", "utf8");
  const [, handwritten = ""] = migration.split("-- ===== Handwritten");
  const [statement = ""] = handwritten.replace(/^.*=====\n/, "").split("--> statement-breakpoint");
  return statement.trim();
}

test("migration 0021: every code becomes a room, with the creator as owner", async () => {
  const ana = await account("Ana");
  const bia = await account("Bia");
  const stamp = Date.now().toString(36);
  const created = `antiga-criada-${stamp}`;
  const claimed = `antiga-anfitria-${stamp}`;
  const orphan = `antiga-sem-dono-${stamp}`;
  // The host controls already registered this code, with whoever got the first token.
  await db.insert(schema.roomDefinitions).values({ code: claimed, ownerUserId: bia });

  // A temporary room_codes lives on one connection only: the whole run uses the same client.
  const client = await pool.connect();
  try {
    await client.query(`create temporary table room_codes
      (code text primary key, created_by_user_id uuid, created_at timestamptz not null default now())`);
    await client.query(
      "insert into room_codes (code, created_by_user_id) values ($1, $2), ($3, $2), ($4, null)",
      [created, ana, claimed, orphan],
    );
    await client.query(registryStatement());
  } finally {
    await client.query("drop table if exists pg_temp.room_codes");
    client.release();
  }

  const rows = await db
    .select({
      code: schema.roomDefinitions.code,
      owner: schema.roomDefinitions.ownerUserId,
      kind: schema.roomDefinitions.kind,
    })
    .from(schema.roomDefinitions)
    .where(inArray(schema.roomDefinitions.code, [created, claimed, orphan]));
  const byCode = new Map(rows.map((row) => [row.code, row]));
  assert.deepEqual(byCode.get(created), { code: created, owner: ana, kind: "ad_hoc" });
  assert.deepEqual(byCode.get(claimed), { code: claimed, owner: ana, kind: "ad_hoc" });
  assert.deepEqual(byCode.get(orphan), { code: orphan, owner: null, kind: "ad_hoc" });
});
