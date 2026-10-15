import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** The status each person picks, and what friends see. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const statuses = await import("@/features/friends/status-actions.server");
const store = await import("@/features/friends/server/presence-status.server");
const { markOnline } = await import("@/features/friends/server/online-presence.server");
const { anonymizeParticipant } =
  await import("@/features/account/server/participant-accounts.server");
const { personalData } = await import("@/features/account/server/personal-data.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

describe("presence status", () => {
  test("starts as Online and the choice is saved on the account", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    expect(await store.chosenStatus(db, ana.id)).toBe("online");
    as(ana);
    expect(await statuses.setPresenceStatus({ status: "busy" })).toEqual({
      data: { status: "busy" },
    });
    expect(await store.chosenStatus(db, ana.id)).toBe("busy");
    // Offline is never picked: it only means nobody is connected.
    const offline = await statuses.setPresenceStatus({ status: "offline" as never });
    expect(offline.validationErrors).toBeDefined();
  });

  test("friends see the choice while connected, and Invisible as Offline", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    as(ana);
    await statuses.setPresenceStatus({ status: "away" });
    expect((await store.shownStatuses(db, [ana.id])).get(ana.id)).toBe("offline");
    markOnline(ana.id);
    expect((await store.shownStatuses(db, [ana.id])).get(ana.id)).toBe("away");
    await statuses.setPresenceStatus({ status: "invisible" });
    markOnline(bia.id);
    const seen = await store.shownStatuses(db, [ana.id, bia.id]);
    expect(seen.get(ana.id)).toBe("offline");
    expect(seen.get(bia.id)).toBe("online");
  });

  test("the export lists it, and account deletion forgets it", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    as(ana);
    await statuses.setPresenceStatus({ status: "busy" });
    expect((await personalData(db, ana.id)).status_escolhido?.status).toBe("Não perturbe");
    await db.transaction((tx) => anonymizeParticipant(tx, ana.id));
    const rows = await db
      .select()
      .from(schema.userPresence)
      .where(eq(schema.userPresence.userId, ana.id));
    expect(rows).toEqual([]);
  });
});
