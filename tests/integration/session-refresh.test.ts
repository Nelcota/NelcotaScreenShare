import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { RouterContextProvider } from "react-router";
import { afterAll, test } from "vitest";
import { withRequest } from "@/server/request-context.server";
import { withResponseCookies } from "@/server/response-cookies.server";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const { getAdminSession } = await import("@/features/auth/server/admin-session.server");
const { getUserSession } = await import("@/features/auth/server/participant-session.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

test("parallel loaders renew the admin and participant browser cookies with their database sessions", async () => {
  const admin = await adminSession(db, "viewer");
  const participant = await verifiedParticipant(db, (request) => getUserAuth().handler(request));
  await db
    .update(schema.adminSessions)
    .set({ expiresAt: new Date(Date.now() + 10 * 60 * 60_000) })
    .where(eq(schema.adminSessions.userId, admin.id));
  await db
    .update(schema.userSessions)
    .set({ expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60_000) })
    .where(eq(schema.userSessions.userId, participant.id));
  const request = new Request("http://localhost:3000/conta", {
    headers: { cookie: `${admin.headers.get("cookie")}; ${participant.jar.header()}` },
  });
  const context = new RouterContextProvider();
  const response = await withResponseCookies(() =>
    withRequest(request, context, async () => {
      const sessions = await Promise.all([getAdminSession(), getUserSession(), getAdminSession()]);
      assert.equal(sessions[0]?.user.id, admin.id);
      assert.equal(sessions[1]?.user.id, participant.id);
      return Response.json({ ok: true });
    }),
  );
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(
    cookies.some(
      (value) => value.startsWith("nelcota-admin.session_token=") && /Max-Age=43200/i.test(value),
    ),
  );
  assert.ok(
    cookies.some(
      (value) => value.startsWith("nelcota.session_token=") && /Max-Age=2592000/i.test(value),
    ),
  );
  const adminRow = await db.query.adminSessions.findFirst({
    where: eq(schema.adminSessions.userId, admin.id),
  });
  assert.ok(adminRow && adminRow.expiresAt.getTime() > Date.now() + 11 * 60 * 60_000);
});
