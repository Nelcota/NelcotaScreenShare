import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { USAGE_DAYS } from "@/features/admin/usage/domain/period";
import {
  browserShares,
  dailySocial,
  dailyUsage,
} from "@/features/admin/usage/server/queries.server";
import * as schema from "@/server/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const MINUTE = 60 * 1000;

test("daily usage counts rooms, distinct people and minutes per São Paulo day", async () => {
  // Yesterday at noon in São Paulo: every timestamp stays inside one past local day.
  const sameHourYesterday = new Date(Date.now() - 24 * 60 * MINUTE);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    sameHourYesterday,
  );
  const noon = new Date(`${yesterday}T15:00:00Z`);
  const at = (minutes: number) => new Date(noon.getTime() + minutes * MINUTE);
  const [room] = await db
    .insert(schema.rooms)
    .values({ code: "uso-ontem", startedAt: at(0), status: "finished", finishedAt: at(60) })
    .returning();
  assert.ok(room);
  await db.insert(schema.roomParticipations).values([
    {
      roomId: room.id,
      livekitIdentity: "ana",
      livekitSid: "PA_u1",
      joinedAt: at(0),
      leftAt: at(30),
    },
    // Same person back later: counts once, minutes add up.
    {
      roomId: room.id,
      livekitIdentity: "ana",
      livekitSid: "PA_u2",
      joinedAt: at(40),
      leftAt: at(50),
    },
    {
      roomId: room.id,
      livekitIdentity: "bia",
      livekitSid: "PA_u3",
      joinedAt: at(5),
      leftAt: at(25),
    },
  ]);

  const days = await dailyUsage(db);
  assert.equal(days.length, USAGE_DAYS);
  const day = days.find((entry) => entry.day === yesterday);
  assert.deepEqual(day, { day: yesterday, rooms: 1, people: 2, minutes: 60 });
});

test("browsers of the open sessions are grouped by family", async () => {
  const [user] = await db
    .insert(schema.users)
    .values({ name: "Uso", email: `uso-${Date.now()}@exemplo.com` })
    .returning();
  assert.ok(user);
  const chrome = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";
  const firefox = "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0";
  const session = (agent: string, index: number) => ({
    userId: user.id,
    token: `token-uso-${index}-${Date.now()}`,
    expiresAt: new Date(Date.now() + 60 * MINUTE),
    userAgent: agent,
  });
  await db.insert(schema.userSessions).values([
    session(chrome, 1),
    session(chrome, 2),
    session(firefox, 3),
    // Already expired: not an open session.
    { ...session(firefox, 4), expiresAt: new Date(Date.now() - MINUTE) },
  ]);

  assert.deepEqual(await browserShares(db), [
    { browser: "Chrome", sessions: 2 },
    { browser: "Firefox", sessions: 1 },
  ]);
});

test("messages, new groups and friend requests per São Paulo day, counts only", async () => {
  const sameHourYesterday = new Date(Date.now() - 24 * 60 * MINUTE);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    sameHourYesterday,
  );
  const noon = new Date(`${yesterday}T15:00:00Z`);
  const people = await db
    .insert(schema.users)
    .values([
      { name: "Ana", email: `social-a-${Date.now()}@exemplo.com` },
      { name: "Bia", email: `social-b-${Date.now()}@exemplo.com` },
    ])
    .returning({ id: schema.users.id });
  const [low, high] = people.map((person) => person.id).toSorted();
  assert.ok(low && high);
  const [group] = await db
    .insert(schema.conversations)
    .values({ kind: "group", name: "Turma", createdBy: low, createdAt: noon })
    .returning();
  assert.ok(group);
  await db.insert(schema.messages).values([
    { conversationId: group.id, authorId: low, body: "oi", createdAt: noon },
    { conversationId: group.id, authorId: high, body: "olá", createdAt: noon },
  ]);
  await db
    .insert(schema.friendships)
    .values({ userLowId: low, userHighId: high, requestedBy: low, createdAt: noon });

  const before = (await dailySocial(db)).find((entry) => entry.day === yesterday);
  assert.ok(before);
  assert.ok(before.messages >= 2 && before.groups >= 1 && before.friendRequests >= 1);
  await db.insert(schema.messages).values({
    conversationId: group.id,
    authorId: low,
    body: "mais uma",
    createdAt: noon,
  });
  const after = (await dailySocial(db)).find((entry) => entry.day === yesterday);
  assert.equal(after?.messages, before.messages + 1);
  assert.equal((await dailySocial(db)).length, USAGE_DAYS);
});
