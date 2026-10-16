import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { users } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** With REQUIRE_EMAIL_VERIFICATION on (as in these tests), operations follow the pages. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friends = await import("@/features/friends/actions.server");
const chat = await import("@/features/messages/actions.server");
const account = await import("@/features/account/actions.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

describe("an account whose e-mail is not confirmed", () => {
  test("cannot use friends or messages, and still manages its own account", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, ana.id));
    requestHeaders.current = new Headers({ cookie: ana.jar.header(), "user-agent": "vitest" });

    const refused = {
      serverError: "Confirme seu e-mail para continuar. O link está na sua caixa de entrada.",
    };
    expect(await friends.sendFriendRequest({ userId: bia.id })).toEqual(refused);
    expect(await chat.listConversations({})).toEqual(refused);
    expect((await account.revokeMyOtherSessions(undefined)).serverError).toBeUndefined();
  });
});
