import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** The profile beside a conversation: code, since when and mutual friends. */
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => new Headers(),
}));

const { friendProfile } = await import("@/features/friends/server/friend-profile.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

async function friends(one: string, other: string) {
  const [low, high] = [one, other].toSorted();
  if (!low || !high) throw new Error("two people");
  await db.insert(schema.friendships).values({
    userLowId: low,
    userHighId: high,
    requestedBy: low,
    status: "accepted",
    acceptedAt: new Date("2026-10-01T12:00:00Z"),
  });
}

describe("friend profile", () => {
  test("shows the shared code, since when and the friends both have", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    const duda = await verifiedParticipant(db, handler, { name: "Duda" });
    await friends(ana.id, bia.id);
    await friends(ana.id, caio.id);
    await friends(bia.id, caio.id);
    await friends(bia.id, duda.id);

    const profile = await friendProfile(db, ana.id, bia.id);
    expect(profile?.code).toMatch(/^NELC-[2-9A-HJKMNP-Z]{4,5}$/);
    expect(profile?.since).toEqual(new Date("2026-10-01T12:00:00Z"));
    expect(profile?.mutual).toEqual({ shown: [{ id: caio.id, name: "Caio" }], total: 1 });
    expect(JSON.stringify(profile)).not.toContain("@");
  });

  test("nothing for someone who is not a friend", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const stranger = await verifiedParticipant(db, handler, { name: "Estranho" });
    expect(await friendProfile(db, ana.id, stranger.id)).toBeNull();
  });
});
