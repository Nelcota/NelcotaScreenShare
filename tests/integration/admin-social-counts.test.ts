import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { socialCounts } from "@/features/admin/participants/server/social-counts.server";
import * as schema from "@/server/db/schema";

/** Participant page: how many friends and blocks, never who. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

async function account(): Promise<string> {
  const [user] = await db
    .insert(schema.users)
    .values({ name: "Pessoa", email: `contagem-${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

function pair(a: string, b: string) {
  return a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };
}

test("counts accepted friends on either side and blocks made and received", async () => {
  const [ana, bia, caio, duda] = await Promise.all([account(), account(), account(), account()]);
  await db.insert(schema.friendships).values([
    { ...pair(ana, bia), requestedBy: bia, status: "accepted", acceptedAt: new Date() },
    { ...pair(ana, caio), requestedBy: ana, status: "accepted", acceptedAt: new Date() },
    { ...pair(ana, duda), requestedBy: duda, status: "pending" },
  ]);
  await db.insert(schema.userBlocks).values([
    { blockerId: ana, blockedId: duda },
    { blockerId: bia, blockedId: ana },
    { blockerId: caio, blockedId: ana },
  ]);

  assert.deepEqual(await socialCounts(db, ana), { friends: 2, blocksMade: 1, blocksReceived: 2 });
  assert.deepEqual(await socialCounts(db, await account()), {
    friends: 0,
    blocksMade: 0,
    blocksReceived: 0,
  });
});
