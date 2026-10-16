import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { getWaitlist, iterateWaitlist } from "@/features/admin/waitlist/server/queries.server";
import * as schema from "@/server/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

test("the Pro list shows the newest first and exports everyone in sign-up order", async () => {
  await db.insert(schema.proInterests).values({ email: "primeira@exemplo.com" });
  await db.insert(schema.proInterests).values({ email: "segunda@exemplo.com" });

  const { total, latest } = await getWaitlist(db);
  assert.equal(total, 2);
  assert.deepEqual(
    latest.map((entry) => entry.email),
    ["segunda@exemplo.com", "primeira@exemplo.com"],
  );

  const exported: string[] = [];
  for await (const entry of iterateWaitlist(db)) exported.push(entry.email);
  assert.deepEqual(exported, ["primeira@exemplo.com", "segunda@exemplo.com"]);
});
