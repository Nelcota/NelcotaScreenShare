import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { moderateParticipant, removeFromCall } from "@/features/room/server/moderation.server";
import { bannedFromCall } from "@/features/room/server/room-bans.server";
import { createRoom } from "@/features/room/server/room-codes.server";
import * as schema from "@/server/db/schema";

/** Kick and ban against saved roles, with LiveKit as an object literal. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const GUEST = "convidado-4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10";
let counter = 0;

async function account(name: string): Promise<string> {
  counter += 1;
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `moderacao${counter}-${Date.now()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

/** A room with an owner, a moderator and a plain participant account. */
async function roomWithRoles() {
  const [owner, moderator, participant] = await Promise.all(["Ana", "Bia", "Caio"].map(account));
  assert.ok(owner && moderator && participant);
  const room = await createRoom(db, owner);
  await db
    .insert(schema.roomRoles)
    .values({ roomCode: room, userId: moderator, role: "moderator", grantedByUserId: owner });
  return { room, owner, moderator, participant };
}

function fakeLiveKit(inRoom: string[], { closed = false } = {}) {
  const sid = closed ? undefined : `RM_${crypto.randomUUID()}`;
  const removed: string[] = [];
  return {
    removed,
    gateway: {
      roomSid: () => Promise.resolve(sid),
      removeParticipant: (_room: string, identity: string) => {
        if (!inRoom.includes(identity)) return Promise.resolve(false);
        removed.push(identity);
        return Promise.resolve(true);
      },
    },
  };
}

test("the owner kicks a moderator; a moderator kicks a guest", async () => {
  const { room, owner, moderator } = await roomWithRoles();
  const livekit = fakeLiveKit([moderator, GUEST]);
  const byOwner = await moderateParticipant(db, livekit.gateway, {
    room,
    identity: moderator,
    action: "kick",
    actorUserId: owner,
  });
  assert.deepEqual(byOwner, { ok: true });
  const byModerator = await moderateParticipant(db, livekit.gateway, {
    room,
    identity: GUEST,
    action: "kick",
    actorUserId: moderator,
  });
  assert.deepEqual(byModerator, { ok: true });
  assert.deepEqual(livekit.removed, [moderator, GUEST]);
});

test("refused: a participant, a moderator against the owner, anyone against themselves", async () => {
  const { room, owner, moderator, participant } = await roomWithRoles();
  const livekit = fakeLiveKit([owner, moderator, participant, GUEST]);
  const attempts: [string, string][] = [
    [participant, GUEST],
    [moderator, owner],
    [owner, owner],
    [moderator, moderator],
  ];
  for (const [actorUserId, identity] of attempts) {
    const result = await moderateParticipant(db, livekit.gateway, {
      room,
      identity,
      action: "kick",
      actorUserId,
    });
    assert.equal(result.ok ? "ok" : result.error, "forbidden");
  }
  // A role in another room grants nothing here.
  const elsewhere = await moderateParticipant(db, livekit.gateway, {
    room: `outra-${room}`,
    identity: participant,
    action: "kick",
    actorUserId: owner,
  });
  assert.equal(elsewhere.ok ? "ok" : elsewhere.error, "forbidden");
  assert.deepEqual(livekit.removed, []);
});

test("ban: recorded for this call, even when the person had just left", async () => {
  const { room, owner, participant } = await roomWithRoles();
  const livekit = fakeLiveKit([participant]);
  for (const identity of [participant, GUEST]) {
    const result = await moderateParticipant(db, livekit.gateway, {
      room,
      identity,
      action: "ban",
      actorUserId: owner,
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(await bannedFromCall(db, livekit.gateway, { roomCode: room, identity }), true);
  }
  assert.deepEqual(livekit.removed, [participant]);
});

test("kicking someone who already left, or banning in a closed room: not in the room", async () => {
  const { room, owner, participant } = await roomWithRoles();
  const kick = await moderateParticipant(db, fakeLiveKit([]).gateway, {
    room,
    identity: participant,
    action: "kick",
    actorUserId: owner,
  });
  assert.equal(kick.ok ? "ok" : kick.error, "not_in_room");
  const closed = await moderateParticipant(db, fakeLiveKit([], { closed: true }).gateway, {
    room,
    identity: participant,
    action: "ban",
    actorUserId: owner,
  });
  assert.equal(closed.ok ? "ok" : closed.error, "not_in_room");
});

test("the admin panel removes anyone, the owner included", async () => {
  const { room, owner } = await roomWithRoles();
  const [admin] = await db
    .insert(schema.adminUsers)
    .values({ name: "Admin", email: `admin-mod-${Date.now()}@exemplo.com` })
    .returning({ id: schema.adminUsers.id });
  assert.ok(admin);
  const livekit = fakeLiveKit([owner]);
  const result = await removeFromCall(
    db,
    livekit.gateway,
    { room, identity: owner, action: "ban" },
    { adminId: admin.id },
  );
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(livekit.removed, [owner]);
});
