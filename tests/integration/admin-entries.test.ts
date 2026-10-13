import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { denialsByReason, recentDenials } from "@/features/admin/entries/server/queries.server";
import { createRoom } from "@/features/room/server/room-codes.server";
import * as schema from "@/server/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

test("denied joins are counted per reason and listed without granted ones", async () => {
  await db.insert(schema.tokenRequests).values([
    { roomCode: "sala-a", result: "granted" },
    { roomCode: "sala-a", result: "room_full", ip: "203.0.113.9" },
    { roomCode: "sala-a", result: "room_full", createdAt: ago(30) },
    { roomCode: "sala-b", result: "wrong_password", createdAt: ago(2) },
    { roomCode: "sala-velha", result: "blocked", createdAt: ago(24 * 8) },
  ]);

  assert.deepEqual(await denialsByReason(db), [
    { reason: "room_full", lastDay: 1, lastWeek: 2 },
    { reason: "wrong_password", lastDay: 1, lastWeek: 1 },
  ]);

  const all = await recentDenials(db, null);
  assert.equal(all.length, 4);
  assert.equal(all[0]?.reason, "room_full");
  assert.ok(!("ip" in (all[0] ?? {})));

  const passwords = await recentDenials(db, "wrong_password");
  assert.deepEqual(
    passwords.map((row) => row.roomCode),
    ["sala-b"],
  );
});

test("a request the owner turned down counts as a denial, dated by the decision", async () => {
  const [owner] = await db
    .insert(schema.users)
    .values({ name: "Dona", email: `dona-${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(owner);
  const code = await createRoom(db, owner.id);
  const request = (status: "pending" | "declined", decidedHoursAgo: number | null) => ({
    roomCode: code,
    guestId: crypto.randomUUID(),
    displayName: "Visitante",
    status,
    expiresAt: new Date(Date.now() + HOUR),
    decidedAt: decidedHoursAgo === null ? null : ago(decidedHoursAgo),
  });
  await db
    .insert(schema.roomJoinRequests)
    .values([
      request("declined", 1),
      request("declined", 30),
      request("declined", 24 * 8),
      request("pending", null),
    ]);

  const counts = await denialsByReason(db);
  assert.deepEqual(
    counts.find((row) => row.reason === "join_declined"),
    { reason: "join_declined", lastDay: 1, lastWeek: 2 },
  );
  const declined = await recentDenials(db, "join_declined");
  assert.equal(declined.length, 3);
  assert.ok(declined.every((row) => row.roomCode === code && row.userId === null));
  // Mixed with the token denials, newest first.
  const all = await recentDenials(db, null);
  assert.equal(all.filter((row) => row.reason === "join_declined").length, 3);
  const times = all.map((row) => row.createdAt.getTime());
  assert.deepEqual(
    times,
    times.toSorted((first, second) => second - first),
  );
});
