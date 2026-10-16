import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** POST /api/sala/som: the server writes the "Sem som" attribute to the (fake) LiveKit with the account's identity. */
const received: { path: string; body: Record<string, unknown> }[] = [];
const fakeLiveKit = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk: Buffer) => (body += chunk.toString()));
  request.on("end", () => {
    const parsed = z.record(z.string(), z.unknown()).parse(JSON.parse(body || "{}"));
    received.push({ path: request.url ?? "", body: parsed });
    response.setHeader("Content-Type", "application/json");
    if (parsed.room === "sala-vazia") {
      response.statusCode = 404;
      response.end(JSON.stringify({ code: "not_found", msg: "participant not found" }));
      return;
    }
    response.end(JSON.stringify({ identity: parsed.identity }));
  });
});
await new Promise<void>((resolve) => fakeLiveKit.listen(0, "127.0.0.1", resolve));
const address = fakeLiveKit.address();
if (!address || typeof address === "string") throw new Error("no port");

Object.assign(process.env, {
  LIVEKIT_URL: `ws://127.0.0.1:${address.port}`,
  AUTH_SECRET: "segredo-participantes-de-teste-0123456789abcdef",
});

const { setDeafened } = await import("@/features/room/server/deafen-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(async () => {
  fakeLiveKit.close();
  await pool.end();
});
const handler = (request: Request) => getUserAuth().handler(request);

function post(body: unknown, cookie?: string, origin = "http://localhost:3000") {
  const headers = new Headers({ "content-type": "application/json", origin });
  if (cookie) headers.set("cookie", cookie);
  return setDeafened(
    new Request("http://localhost:3000/api/sala/som", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("deafen", () => {
  it("writes the attribute with the account's identity", async () => {
    const ana = await verifiedParticipant(db, handler);
    const response = await post({ room: "Sala-Teste", deafened: true }, ana.jar.header());
    expect(response.status).toBe(204);
    const call = received.at(-1);
    expect(call?.path).toContain("UpdateParticipant");
    expect(call?.body).toMatchObject({
      room: "sala-teste",
      identity: ana.id,
      attributes: { deafened: "1" },
    });

    await post({ room: "sala-teste", deafened: false }, ana.jar.header());
    expect(received.at(-1)?.body).toMatchObject({ attributes: { deafened: "" } });
  });

  it("rejects no account, foreign origin and invalid request", async () => {
    expect((await post({ room: "sala-teste", deafened: true })).status).toBe(401);
    const bia = await verifiedParticipant(db, handler);
    const cookie = bia.jar.header();
    expect(
      (await post({ room: "sala-teste", deafened: true }, cookie, "https://x.exemplo")).status,
    ).toBe(403);
    expect((await post({ room: "../x", deafened: true }, cookie)).status).toBe(400);
    expect((await post({ room: "sala-teste", deafened: "sim" }, cookie)).status).toBe(400);
  });

  it("someone not in the room gets 409", async () => {
    const caio = await verifiedParticipant(db, handler);
    expect((await post({ room: "sala-vazia", deafened: true }, caio.jar.header())).status).toBe(
      409,
    );
  });
});
