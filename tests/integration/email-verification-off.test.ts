import assert from "node:assert/strict";
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, test } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { CookieJar, makeCaller } from "./support/http-auth";

/**
 * Email verification off (REQUIRE_EMAIL_VERIFICATION=false, the default
 * for now): sign-up logs straight into the account, with no link, and the
 * unverified account can get a room token.
 */
const fakeLiveKit = createServer((_request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ participants: [] }));
});
await new Promise<void>((resolve) => fakeLiveKit.listen(0, "127.0.0.1", resolve));
const address = fakeLiveKit.address();
assert.ok(address && typeof address !== "string");

Object.assign(process.env, {
  REQUIRE_EMAIL_VERIFICATION: "false",
  LIVEKIT_URL: `ws://127.0.0.1:${address.port}`,
  ACCESS_PASSWORD: "",
});

const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { requestRoomToken } = await import("@/features/room/server/token-route.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(async () => {
  fakeLiveKit.close();
  await pool.end();
});

const call = makeCaller((request) => getUserAuth().handler(request), "/api/auth", "198.51.100.40");
const PASSWORD = "senha-sem-confirmar-1";

describe("email verification off", () => {
  test("sign-up opens the session and the account joins a room without verifying", async () => {
    const email = `sem-confirmar-${Date.now()}@exemplo.com`;
    const jar = new CookieJar();
    const signUp = await call("/sign-up/email", {
      body: { name: "Tati", email, password: PASSWORD },
      jar,
    });
    assert.equal(signUp.status, 200);
    assert.ok(jar.has("session_token"), "session created on sign-up");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    assert.equal(user?.emailVerified, false);

    await db.insert(schema.roomDefinitions).values({ code: "sala-sem-confirmar" });
    const response = await requestRoomToken(
      new Request("http://localhost:3000/api/token", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-client-ip": "198.51.100.41",
          cookie: jar.header(),
        },
        body: JSON.stringify({ room: "sala-sem-confirmar" }),
      }),
    );
    assert.equal(response.status, 200);
    assert.ok(z.object({ token: z.string() }).parse(await response.json()).token);
  });

  test("unverified account can sign in; duplicate email is reported", async () => {
    const email = `sem-confirmar-2-${Date.now()}@exemplo.com`;
    await call("/sign-up/email", { body: { name: "Uli", email, password: PASSWORD } });
    const jar = new CookieJar();
    const signIn = await call("/sign-in/email", { body: { email, password: PASSWORD }, jar });
    assert.equal(signIn.status, 200);
    assert.ok(jar.has("session_token"));

    const again = await call("/sign-up/email", {
      body: { name: "Outra", email, password: "outra-senha-qualquer" },
    });
    assert.equal(again.status, 422);
    assert.equal(
      z.object({ code: z.string() }).parse(again.body).code,
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    );
  });
});
