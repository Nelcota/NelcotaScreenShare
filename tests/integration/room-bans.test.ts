import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { banFromCall, bannedFromCall } from "@/features/room/server/room-bans.server";
import * as schema from "@/server/db/schema";

/** A ban lasts for one call: the room's LiveKit sid at the time of the ban. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const callNow = (sid: string | undefined) => ({ roomSid: () => Promise.resolve(sid) });

/** The room page request, with or without the guest cookie. */
function page(cookie?: string) {
  return new Request("http://localhost/sala", { headers: cookie ? { cookie } : {} });
}

test("banned while the same call lasts; a new call or a closed room lets them back", async () => {
  const [owner] = await db
    .insert(schema.users)
    .values({ name: "Ana", email: `banidora-${Date.now()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(owner);
  const roomCode = `banida-${Date.now().toString(36)}`;
  const identity = "convidado-4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10";
  const livekitRoomSid = `RM_${crypto.randomUUID()}`;
  const ban = { roomCode, identity, livekitRoomSid, bannedBy: { userId: owner.id } };
  await banFromCall(db, ban);
  // Banning twice keeps a single record.
  await banFromCall(db, ban);
  const rows = await db
    .select()
    .from(schema.roomBans)
    .where(eq(schema.roomBans.roomCode, roomCode));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.bannedByUserId, owner.id);

  assert.equal(await bannedFromCall(db, callNow(livekitRoomSid), { roomCode, identity }), true);
  assert.equal(await bannedFromCall(db, callNow("RM_outra"), { roomCode, identity }), false);
  assert.equal(await bannedFromCall(db, callNow(undefined), { roomCode, identity }), false);
  assert.equal(
    await bannedFromCall(db, callNow(livekitRoomSid), { roomCode, identity: "outra-pessoa" }),
    false,
  );
});

test("someone never banned does not cost a LiveKit call", async () => {
  let asked = 0;
  const gateway = {
    roomSid: () => {
      asked += 1;
      return Promise.resolve("RM_qualquer");
    },
  };
  const banned = await bannedFromCall(db, gateway, { roomCode: "sala-limpa", identity: "ana" });
  assert.equal(banned, false);
  assert.equal(asked, 0);
});

test("the room page knows whether the account or the guest cookie was banned", async () => {
  process.env.AUTH_SECRET ??= "segredo-participantes-de-teste-0123456789abcdef";
  const { newGuestSession } = await import("@/features/room/server/guest-session.server");
  const { visitorBannedFromCall } = await import("@/features/room/server/room-bans.server");
  const roomCode = `pagina-${Date.now().toString(36)}`;
  const livekitRoomSid = `RM_${crypto.randomUUID()}`;
  const accountId = crypto.randomUUID();
  const { guestId, setCookie } = await newGuestSession(new Request("http://localhost/sala"));
  await db.insert(schema.roomBans).values([
    { roomCode, identity: accountId, livekitRoomSid },
    { roomCode, identity: `convidado-${guestId}`, livekitRoomSid },
  ]);
  const gateway = callNow(livekitRoomSid);

  const account = { roomCode, userId: accountId, request: page() };
  assert.equal(await visitorBannedFromCall(db, gateway, account), true);
  const guest = { roomCode, userId: undefined, request: page(setCookie.split(";")[0]) };
  assert.equal(await visitorBannedFromCall(db, gateway, guest), true);
  const stranger = { roomCode, userId: undefined, request: page() };
  assert.equal(await visitorBannedFromCall(db, gateway, stranger), false);
  const nextCall = callNow("RM_proxima");
  assert.equal(await visitorBannedFromCall(db, nextCall, account), false);
});
