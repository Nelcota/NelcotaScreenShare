import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** POST /api/amigos/presenca: an open tab marks the signed-in person as online. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const { recordPresence } = await import("@/features/friends/server/presence-route.server");
const { isOnline } = await import("@/features/friends/server/online-presence.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

function beat(cookie: string | null, origin = "http://localhost:3000") {
  requestHeaders.current = new Headers({ "user-agent": "vitest", ...(cookie ? { cookie } : {}) });
  return recordPresence(
    new Request("http://localhost:3000/api/amigos/presenca", {
      method: "POST",
      headers: { origin },
    }),
  );
}

describe("presence beat", () => {
  test("marks the signed-in person online", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    expect(isOnline(ana.id)).toBe(false);
    expect((await beat(ana.jar.header())).status).toBe(204);
    expect(isOnline(ana.id)).toBe(true);
  });

  test("refuses visitors and other sites", async () => {
    expect((await beat(null)).status).toBe(401);
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    expect((await beat(bia.jar.header(), "https://outro-site.example")).status).toBe(403);
    expect(isOnline(bia.id)).toBe(false);
  });
});
