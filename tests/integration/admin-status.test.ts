import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { getLiveKitEventsSummary } from "@/features/admin/status/server/livekit-events.server";
import * as schema from "@/server/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const MINUTE = 60 * 1000;

function event(
  id: string,
  minutesAgo: number,
  extra: Partial<typeof schema.livekitEvents.$inferInsert>,
) {
  const at = new Date(Date.now() - minutesAgo * MINUTE);
  return {
    id,
    event: "participant_joined",
    roomName: "sala-status",
    payload: {},
    occurredAt: at,
    receivedAt: at,
    ...extra,
  };
}

test("the status page shows the last event and only failed ones, with safe errors", async () => {
  const empty = await getLiveKitEventsSummary(db);
  assert.equal(empty.lastEvent, null);
  assert.equal(empty.failedCount, 0);

  await db.insert(schema.livekitEvents).values([
    event("EV_ok", 30, { processedAt: new Date() }),
    event("EV_failed", 20, {
      event: "track_published",
      error: "Failed query: insert into share_sessions\nparams: 203.0.113.7",
    }),
    // Just arrived and still being projected: no error yet, so not a failure.
    event("EV_pending", 1, { event: "room_finished" }),
  ]);

  const summary = await getLiveKitEventsSummary(db);
  assert.equal(summary.lastEvent?.event, "room_finished");
  assert.equal(summary.failedCount, 1);
  assert.deepEqual(
    summary.recentFailures.map((failure) => ({
      id: failure.id,
      event: failure.event,
      error: failure.error,
    })),
    [{ id: "EV_failed", event: "track_published", error: "Falha ao gravar no banco" }],
  );
});
