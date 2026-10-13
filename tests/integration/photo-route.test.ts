import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { users } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** GET /api/sala/foto: the (fake) LiveKit says who is in each room. */
const rooms = new Map<string, string[]>();
const fakeLiveKit = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk: Buffer) => (body += chunk.toString()));
  request.on("end", () => {
    const { room } = z.object({ room: z.string() }).parse(JSON.parse(body || "{}"));
    response.setHeader("Content-Type", "application/json");
    const identities = rooms.get(room);
    if (!identities) {
      response.statusCode = 404;
      response.end(JSON.stringify({ code: "not_found", msg: "requested room does not exist" }));
      return;
    }
    response.end(JSON.stringify({ participants: identities.map((identity) => ({ identity })) }));
  });
});
await new Promise<void>((resolve) => fakeLiveKit.listen(0, "127.0.0.1", resolve));
const address = fakeLiveKit.address();
if (!address || typeof address === "string") throw new Error("no port");
Object.assign(process.env, { LIVEKIT_URL: `ws://127.0.0.1:${address.port}` });

const { participantPhoto } = await import("@/features/room/server/photo-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { newGuestSession } = await import("@/features/room/server/guest-session.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(async () => {
  fakeLiveKit.close();
  await pool.end();
});
const handler = (request: Request) => getUserAuth().handler(request);

const PHOTO_BYTES = Buffer.from("RIFF fake webp bytes");
const PHOTO = `data:image/webp;base64,${PHOTO_BYTES.toString("base64")}`;

function photo(room: string, person: string, cookie?: string, etag?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (etag) headers.set("if-none-match", etag);
  const query = new URLSearchParams({ sala: room, pessoa: person });
  return participantPhoto(new Request(`http://localhost:3000/api/sala/foto?${query}`, { headers }));
}

async function withPhoto(name: string) {
  const person = await verifiedParticipant(db, handler, { name });
  await db.update(users).set({ image: PHOTO }).where(eq(users.id, person.id));
  return person;
}

describe("photo of someone in the call", () => {
  it("serves the photo to someone in the same call, with a cache validator", async () => {
    const ana = await verifiedParticipant(db, handler);
    const bia = await withPhoto("Bia");
    rooms.set("sala-foto", [ana.id, bia.id]);

    const response = await photo("sala-foto", bia.id, ana.jar.header());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PHOTO_BYTES);

    const etag = response.headers.get("etag") ?? "";
    const again = await photo("sala-foto", bia.id, ana.jar.header(), etag);
    expect(again.status).toBe(304);
  });

  it("a guest in the call also sees it", async () => {
    const bia = await withPhoto("Bia");
    const { guestId, setCookie } = await newGuestSession(
      new Request("http://localhost:3000/api/token"),
    );
    rooms.set("sala-convidado", [`convidado-${guestId}`, bia.id]);
    const response = await photo("sala-convidado", bia.id, setCookie.split(";")[0]);
    expect(response.status).toBe(200);
  });

  it("does not tell who is in a room to someone outside it", async () => {
    const ana = await verifiedParticipant(db, handler);
    const bia = await withPhoto("Bia");
    rooms.set("sala-alheia", [bia.id]);
    const outside = await photo("sala-alheia", bia.id, ana.jar.header());
    expect(outside.status).toBe(404);
    expect(outside.headers.get("cache-control")).toBe("no-store");

    rooms.set("sala-sem-bia", [ana.id]);
    expect((await photo("sala-sem-bia", bia.id, ana.jar.header())).status).toBe(404);
    expect((await photo("sala-inexistente", bia.id, ana.jar.header())).status).toBe(404);
  });

  it("someone without a photo, or blocked, shows none", async () => {
    const ana = await verifiedParticipant(db, handler);
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    const dani = await withPhoto("Dani");
    await db.update(users).set({ blockedAt: new Date() }).where(eq(users.id, dani.id));
    rooms.set("sala-sem-foto", [ana.id, caio.id, dani.id]);

    const noPhoto = await photo("sala-sem-foto", caio.id, ana.jar.header());
    expect(noPhoto.status).toBe(404);
    expect(noPhoto.headers.get("cache-control")).toBe("private, max-age=60");
    expect((await photo("sala-sem-foto", dani.id, ana.jar.header())).status).toBe(404);
  });

  it("one's own photo does not need the room list", async () => {
    const eva = await withPhoto("Eva");
    expect((await photo("sala-nenhuma", eva.id, eva.jar.header())).status).toBe(200);
  });

  it("rejects no session and an invalid request", async () => {
    const ana = await verifiedParticipant(db, handler);
    expect((await photo("sala-foto", ana.id)).status).toBe(401);
    expect((await photo("../x", ana.id, ana.jar.header())).status).toBe(400);
    expect((await photo("sala-foto", "nao-e-uuid", ana.jar.header())).status).toBe(400);
  });
});
