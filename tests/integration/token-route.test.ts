import assert from "node:assert/strict";
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, test } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/**
 * POST /api/token end to end: a real account in Postgres and a fake LiveKit
 * that answers ListParticipants (Twirp/JSON) based on the room name.
 */
const ACCESS = "senha-de-acesso-123";
const jsonObject = z.record(z.string(), z.unknown());
const errorBody = z.object({ error: z.string() });
const tokenBody = z.object({ token: z.string(), serverUrl: z.string() });

const fakeLiveKit = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk: Buffer) => (body += chunk.toString()));
  request.on("end", () => {
    const { room, names } = jsonObject.parse(JSON.parse(body || "{}"));
    response.setHeader("Content-Type", "application/json");
    // ListRooms (the current call's sid, read only when someone has a ban on record).
    if (request.url?.endsWith("/ListRooms")) {
      const rooms = z.array(z.string()).parse(names);
      response.end(JSON.stringify({ rooms: rooms.map((name) => ({ name, sid: `RM_${name}` })) }));
      return;
    }
    if (room === "sala-nova") {
      response.statusCode = 404;
      response.end(JSON.stringify({ code: "not_found", msg: "room not found" }));
      return;
    }
    if (room === "sala-quebrada") {
      response.statusCode = 500;
      response.end(JSON.stringify({ code: "internal", msg: "boom" }));
      return;
    }
    if (room === "sala-so-convidados") {
      response.end(JSON.stringify({ participants: [{ identity: "convidado-outro" }] }));
      return;
    }
    const count = room === "sala-cheia" ? 3 : 1;
    response.end(
      JSON.stringify({
        participants: Array.from({ length: count }, (_, i) => ({ identity: `p${i}` })),
      }),
    );
  });
});
await new Promise<void>((resolve) => fakeLiveKit.listen(0, "127.0.0.1", resolve));
const address = fakeLiveKit.address();
assert.ok(address && typeof address !== "string");

Object.assign(process.env, {
  LIVEKIT_URL: `ws://127.0.0.1:${address.port}`,
  ACCESS_PASSWORD: ACCESS,
  MAX_PARTICIPANTS: "3",
  AUTH_SECRET: "segredo-participantes-de-teste-0123456789abcdef",
});

const { requestRoomToken } = await import("@/features/room/server/token-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { createRoomInvite } = await import("@/features/room/server/invites.server");
const { createRoom } = await import("@/features/room/server/room-codes.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(async () => {
  fakeLiveKit.close();
  await pool.end();
});

const handler = (request: Request) => getUserAuth().handler(request);

/** Rooms only exist once created; the tests create theirs straight in the database. */
async function createdRooms(...codes: string[]) {
  await db
    .insert(schema.roomDefinitions)
    .values(codes.map((code) => ({ code })))
    .onConflictDoNothing();
}

await createdRooms(
  "sala-ok",
  "sala-teste",
  "sala-nova",
  "sala-cheia",
  "sala-quebrada",
  "sala-so-convidados",
);

let nextIp = 1;
function freshIp() {
  return `10.0.0.${nextIp++}`;
}

function post(
  body: unknown,
  {
    cookie,
    ip = freshIp(),
    origin = "http://localhost:3000",
  }: { cookie?: string; ip?: string; origin?: string } = {},
) {
  const headers = new Headers({ "content-type": "application/json", origin, "x-client-ip": ip });
  if (cookie) headers.set("cookie", cookie);
  return requestRoomToken(
    new Request("http://localhost:3000/api/token", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function errorCode(response: Response): Promise<string> {
  return errorBody.parse(await response.json()).error;
}

function claims(token: string): Record<string, unknown> {
  const [, payload = ""] = token.split(".");
  return jsonObject.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
}

async function roleIn(response: Response): Promise<unknown> {
  assert.equal(response.status, 200);
  const { token } = tokenBody.parse(await response.json());
  return jsonObject.parse(claims(token).attributes).role;
}

describe("access", () => {
  test("no account and no name: asked for a name, with a signed guest cookie", async () => {
    const response = await post({ room: "sala-ok", password: ACCESS });
    assert.equal(response.status, 400);
    assert.equal(await errorCode(response), "invalid_request");
    assert.match(response.headers.get("set-cookie") ?? "", /^nelcota_convidado=[^;]+; .*HttpOnly/);
  });

  test("a guest joins a room with a host and keeps the identity with the same cookie", async () => {
    const first = await post({ room: "sala-ok", password: ACCESS, guestName: "Iris" });
    assert.equal(first.status, 200);
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const { token } = tokenBody.parse(await first.json());
    const identity = String(claims(token).sub);
    assert.match(identity, /^convidado-/);
    assert.equal(claims(token).name, "Iris");

    const again = await post({ room: "sala-ok", password: ACCESS, guestName: "Iris" }, { cookie });
    assert.equal(again.headers.get("set-cookie"), null);
    assert.equal(claims(tokenBody.parse(await again.json()).token).sub, identity);
  });

  test("a guest waits until someone with an account is in the room", async () => {
    for (const room of ["sala-nova", "sala-so-convidados"]) {
      const response = await post({ room, password: ACCESS, guestName: "Iris" });
      assert.equal(response.status, 409);
      assert.equal(await errorCode(response), "host_absent");
    }
  });

  test("foreign origin: 403", async () => {
    const ana = await verifiedParticipant(db, handler);
    const response = await post(
      { room: "sala-ok", password: ACCESS },
      { cookie: ana.jar.header(), origin: "https://malicioso.exemplo" },
    );
    assert.equal(response.status, 403);
  });

  test("email is no longer verified: 403", async () => {
    const bia = await verifiedParticipant(db, handler);
    await db.update(schema.users).set({ emailVerified: false }).where(eq(schema.users.id, bia.id));
    const response = await post(
      { room: "sala-ok", password: ACCESS },
      { cookie: bia.jar.header() },
    );
    assert.equal(response.status, 403);
    assert.equal(await errorCode(response), "email_unverified");
  });

  test("account blocked from the admin panel: 403", async () => {
    const caio = await verifiedParticipant(db, handler);
    await db
      .update(schema.users)
      .set({ blockedAt: new Date() })
      .where(eq(schema.users.id, caio.id));
    const response = await post(
      { room: "sala-ok", password: ACCESS },
      { cookie: caio.jar.header() },
    );
    assert.equal(response.status, 403);
    assert.equal(await errorCode(response), "blocked");
  });
});

describe("token", () => {
  test("identity and name come from the account; only microphone and screen", async () => {
    const dani = await verifiedParticipant(db, handler, { name: "Dani Souza" });
    const response = await post(
      // A "name" sent by the browser is ignored (it is not in the schema).
      { room: "Sala-Teste", password: ACCESS, name: "Impostor" },
      { cookie: dani.jar.header() },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { token, serverUrl } = tokenBody.parse(await response.json());
    assert.equal(serverUrl, `ws://127.0.0.1:${address.port}`);
    const payload = claims(token);
    assert.equal(payload.sub, dani.id);
    assert.equal(payload.name, "Dani Souza");
    const video = jsonObject.parse(payload.video);
    assert.equal(video.room, "sala-teste");
    assert.deepEqual(video.canPublishSources, [
      "microphone",
      "camera",
      "screen_share",
      "screen_share_audio",
    ]);
    assert.equal(video.canPublishData, true);
    // No changing one's own name in the room: the raised hand goes through the server.
    assert.equal(video.canUpdateOwnMetadata, undefined);
  });

  test("the role goes in the signed token: the creator owns the room", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana Dona" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia Visita" });
    const room = await createRoom(db, ana.id);
    const request = { room, password: ACCESS };
    // Bia asks first: asking first does not make anyone the owner.
    assert.equal(await roleIn(await post(request, { cookie: bia.jar.header() })), "participant");
    assert.equal(await roleIn(await post(request, { cookie: ana.jar.header() })), "owner");
    assert.equal(await roleIn(await post({ ...request, guestName: "Iris" })), "participant");
  });

  test("a code nobody created: 404 room_not_found, for accounts and guests", async () => {
    const lia = await verifiedParticipant(db, handler);
    const room = `bzk-${Date.now().toString(36)}-askjndjkaw`;
    for (const response of [
      await post({ room, password: ACCESS }, { cookie: lia.jar.header() }),
      await post({ room, password: ACCESS, guestName: "Iris" }),
    ]) {
      assert.equal(response.status, 404);
      assert.equal(await errorCode(response), "room_not_found");
    }
    const rows = await requestsOf(room);
    assert.deepEqual(
      rows.map((row) => row.result),
      ["room_not_found", "room_not_found"],
    );
    assert.equal(
      (await db.select().from(schema.roomDefinitions).where(eq(schema.roomDefinitions.code, room)))
        .length,
      0,
    );
  });

  test("new room, full room and LiveKit error", async () => {
    const edu = await verifiedParticipant(db, handler);
    const cookie = edu.jar.header();
    assert.equal((await post({ room: "sala-nova", password: ACCESS }, { cookie })).status, 200);
    const full = await post({ room: "sala-cheia", password: ACCESS }, { cookie });
    assert.equal(full.status, 409);
    assert.equal(await errorCode(full), "room_full");
    const broken = await post({ room: "sala-quebrada", password: ACCESS }, { cookie });
    assert.equal(broken.status, 502);
    assert.equal(await errorCode(broken), "server_error");
  });

  test("validates the body", async () => {
    const fe = await verifiedParticipant(db, handler);
    const cookie = fe.jar.header();
    for (const body of [
      "{não é json",
      { room: "x", password: ACCESS },
      { room: "sala-ok", password: "a".repeat(129) },
    ]) {
      const response = await post(body, { cookie });
      assert.equal(response.status, 400);
      assert.equal(await errorCode(response), "invalid_request");
    }
  });

  test("wrong access password: 5 attempts per IP", async () => {
    const gil = await verifiedParticipant(db, handler);
    const cookie = gil.jar.header();
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      const response = await post({ room: "sala-ok", password: "errada" }, { cookie, ip });
      assert.equal(response.status, 401);
      assert.equal(await errorCode(response), "invalid_password");
    }
    const blocked = await post({ room: "sala-ok", password: ACCESS }, { cookie, ip });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 60);
  });

  test.each(["", ACCESS.slice(0, -1), `${ACCESS}extra`, `${ACCESS}\0`, "\0"])(
    "rejects a mismatched access password without padding or truncation changing equality: %j",
    async (password) => {
      const response = await post({ room: "sala-ok", password, guestName: "Guest" });
      assert.equal(response.status, 401);
      assert.equal(await errorCode(response), "invalid_password");
    },
  );

  test("limit of 20 requests per minute per account, even when switching IPs", async () => {
    const hugo = await verifiedParticipant(db, handler);
    const cookie = hugo.jar.header();
    for (let i = 0; i < 20; i++) {
      assert.equal((await post({ room: "sala-ok", password: ACCESS }, { cookie })).status, 200);
    }
    const limited = await post({ room: "sala-ok", password: ACCESS }, { cookie });
    assert.equal(limited.status, 429);
  });
});

function requestsOf(roomCode: string) {
  return db
    .select()
    .from(schema.tokenRequests)
    .where(eq(schema.tokenRequests.roomCode, roomCode))
    .orderBy(schema.tokenRequests.createdAt);
}

describe("logging to token_requests", () => {
  test("each result becomes a row, with account and IP", async () => {
    const ivo = await verifiedParticipant(db, handler);
    const cookie = ivo.jar.header();
    const room = `sala-registro-${Date.now().toString(36)}`;
    await createdRooms(room);
    await post({ room, password: ACCESS });
    await post({ room, password: "errada" }, { cookie, ip: "198.51.100.9" });
    await post({ room: room.toUpperCase(), password: ACCESS }, { cookie, ip: "198.51.100.9" });

    const rows = await requestsOf(room);
    assert.deepEqual(
      rows.map((row) => row.result),
      ["invalid", "wrong_password", "granted"],
    );
    assert.equal(rows[0]?.userId, null);
    assert.equal(rows[2]?.userId, ivo.id);
    assert.equal(rows[2]?.ip, "198.51.100.9");
  });

  test("someone banned from the current call gets 403 banned, logged as banned", async () => {
    const lia = await verifiedParticipant(db, handler);
    const room = `sala-banida-${Date.now().toString(36)}`;
    await createdRooms(room);
    // The fake LiveKit answers ListRooms with `RM_<room>` as the current call.
    await db
      .insert(schema.roomBans)
      .values({ roomCode: room, identity: lia.id, livekitRoomSid: `RM_${room}` });
    const response = await post({ room, password: ACCESS }, { cookie: lia.jar.header() });
    assert.equal(response.status, 403);
    assert.equal(await errorCode(response), "banned");
    const rows = await requestsOf(room);
    assert.deepEqual(
      rows.map((row) => row.result),
      ["banned"],
    );
  });

  test("full room, LiveKit error and invalid body are logged too", async () => {
    const ju = await verifiedParticipant(db, handler);
    const cookie = ju.jar.header();
    const before = await db
      .select()
      .from(schema.tokenRequests)
      .where(eq(schema.tokenRequests.userId, ju.id));
    assert.equal(before.length, 0);
    await post({ room: "sala-cheia", password: ACCESS }, { cookie });
    await post({ room: "sala-quebrada", password: ACCESS }, { cookie });
    await post("{não é json", { cookie });
    const rows = await db
      .select()
      .from(schema.tokenRequests)
      .where(eq(schema.tokenRequests.userId, ju.id))
      .orderBy(schema.tokenRequests.createdAt);
    assert.deepEqual(
      rows.map((row) => [row.result, row.roomCode]),
      [
        ["room_full", "sala-cheia"],
        ["error", "sala-quebrada"],
        ["invalid", ""],
      ],
    );
  });
});

/** Invite to the room (created if it does not exist yet), as the admin panel would do. */
async function inviteFor(
  code: string,
  { maxUses = null, expiresAt = null }: { maxUses?: number | null; expiresAt?: Date | null } = {},
) {
  const [owner] = await db
    .insert(schema.adminUsers)
    .values({ email: `convite-${crypto.randomUUID()}@exemplo.com`, name: "Admin", role: "admin" })
    .returning({ id: schema.adminUsers.id });
  await createdRooms(code);
  let [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.code, code));
  if (!room) [room] = await db.insert(schema.rooms).values({ code }).returning();
  assert.ok(owner);
  assert.ok(room);
  return createRoomInvite(db, {
    roomId: room.id,
    label: null,
    maxUses,
    expiresAt,
    createdBy: owner.id,
  });
}

describe("room invites", () => {
  test("valid invite joins without the access password", async () => {
    const kai = await verifiedParticipant(db, handler);
    const room = `sala-conv-${Date.now().toString(36)}`;
    const { token } = await inviteFor(room);
    const response = await post({ room, invite: token }, { cookie: kai.jar.header() });
    assert.equal(response.status, 200);
    // Without the invite, the password is still required.
    const without = await post({ room }, { cookie: kai.jar.header() });
    assert.equal(without.status, 401);
  });

  test("limit counts people: whoever already used it can return; the next person is rejected", async () => {
    const room = `sala-lim-${Date.now().toString(36)}`;
    const { id, token } = await inviteFor(room, { maxUses: 1 });
    const leo = await verifiedParticipant(db, handler);
    const mia = await verifiedParticipant(db, handler);
    assert.equal((await post({ room, invite: token }, { cookie: leo.jar.header() })).status, 200);
    assert.equal((await post({ room, invite: token }, { cookie: leo.jar.header() })).status, 200);
    const full = await post({ room, invite: token }, { cookie: mia.jar.header() });
    assert.equal(full.status, 403);
    assert.equal(await errorCode(full), "invite_invalid");
    const [invite] = await db
      .select()
      .from(schema.roomInvites)
      .where(eq(schema.roomInvites.id, id));
    assert.equal(invite?.uses, 1);
    const [logged] = await db
      .select({ result: schema.tokenRequests.result })
      .from(schema.tokenRequests)
      .where(eq(schema.tokenRequests.userId, mia.id));
    assert.equal(logged?.result, "invite_invalid");
  });

  test("expired, revoked, from another room or forged: rejected", async () => {
    const nil = await verifiedParticipant(db, handler);
    const cookie = nil.jar.header();
    const room = `sala-rec-${Date.now().toString(36)}`;
    const expired = await inviteFor(room, { expiresAt: new Date(Date.now() - 1000) });
    const revoked = await inviteFor(room);
    await db
      .update(schema.roomInvites)
      .set({ revokedAt: new Date() })
      .where(eq(schema.roomInvites.id, revoked.id));
    const other = await inviteFor(`outra-${Date.now().toString(36)}`);
    for (const invite of [expired.token, revoked.token, other.token, "x".repeat(43)]) {
      const response = await post({ room, invite }, { cookie });
      assert.equal(response.status, 403, invite);
      assert.equal(await errorCode(response), "invite_invalid");
    }
  });

  test("full room does not use up an invite use", async () => {
    const { id, token } = await inviteFor("sala-cheia", { maxUses: 3 });
    const ota = await verifiedParticipant(db, handler);
    const response = await post(
      { room: "sala-cheia", invite: token },
      { cookie: ota.jar.header() },
    );
    assert.equal(response.status, 409);
    const [invite] = await db
      .select()
      .from(schema.roomInvites)
      .where(eq(schema.roomInvites.id, id));
    assert.equal(invite?.uses, 0);
  });
});
