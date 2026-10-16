import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** POST /sair: the account menu's "Sair" ends the session and goes to the sign-in page. */
const { signOutAndLeave } = await import("@/features/auth/server/sign-out-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

function signOut(
  cookie: string,
  origin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin,
) {
  return signOutAndLeave(
    new Request(`${origin}/sair`, { method: "POST", headers: { cookie, origin } }),
  );
}

async function sessionOf(cookie: string) {
  return getUserAuth().api.getSession({ headers: new Headers({ cookie }) });
}

describe("sign out from the account menu", () => {
  test("ends the session and lands on the sign-in page", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const cookie = ana.jar.header();
    expect(await sessionOf(cookie)).not.toBeNull();

    const response = await signOut(cookie);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/entrar?aviso=saiu");
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    expect(await sessionOf(cookie)).toBeNull();
  });

  test("refuses a form from another site", async () => {
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const response = await signOut(bia.jar.header(), "https://outro-site.example");
    expect(response.status).toBe(403);
    expect(await sessionOf(bia.jar.header())).not.toBeNull();
  });
});
