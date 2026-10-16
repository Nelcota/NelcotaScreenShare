import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test, vi } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** PF1: the pre-join asks only for the call room, instead of reloading every loader. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const { callRoomState } = await import("@/features/ringing/server/call-room-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);
const bodySchema = z.object({ callRoom: z.string().nullable() });

async function joinCall(userId: string) {
  const code = `sala-chamar-${Date.now().toString(36)}`;
  const [room] = await db.insert(schema.rooms).values({ code }).returning();
  assert.ok(room);
  await db.insert(schema.roomParticipations).values({
    roomId: room.id,
    userId,
    livekitIdentity: userId,
    livekitSid: `PA_${crypto.randomUUID()}`,
    displayName: "Ana",
    ip: "203.0.113.30",
    joinedAt: new Date(),
  });
  return code;
}

test("the call room is the signed-in person's open call, and nothing else", async () => {
  const person = await verifiedParticipant(db, handler);
  requestHeaders.current = new Headers({ cookie: person.jar.header() });
  const before = await callRoomState();
  assert.equal(before.status, 200);
  assert.equal(before.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(bodySchema.parse(await before.json()), { callRoom: null });
  const code = await joinCall(person.id);
  assert.deepEqual(bodySchema.parse(await (await callRoomState()).json()), { callRoom: code });
});

test("without a session it answers 401", async () => {
  requestHeaders.current = new Headers();
  const response = await callRoomState();
  assert.equal(response.status, 401);
});
