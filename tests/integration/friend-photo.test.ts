import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { users } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** GET /api/amigos/foto: only friends and pending requests see the photo. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friends = await import("@/features/friends/actions.server");
const { friendPhoto } = await import("@/features/friends/server/friend-photo-route.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;
const PHOTO = `data:image/webp;base64,${Buffer.from("RIFF fake webp").toString("base64")}`;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

function photoOf(person: Person) {
  const query = new URLSearchParams({ pessoa: person.id });
  return friendPhoto(new Request(`http://localhost:3000/api/amigos/foto?${query}`));
}

describe("friend photos", () => {
  test("friends and whoever received a request see it; senders, strangers and blocked people do not", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    await db
      .update(users)
      .set({ image: PHOTO })
      .where(inArray(users.id, [ana.id, bia.id]));

    as(ana);
    expect((await photoOf(bia)).status).toBe(204);
    expect((await friends.friendRelation({ userId: bia.id })).data?.relation).toBe("none");
    await friends.sendFriendRequest({ userId: bia.id });
    // Asking a stranger does not reveal their photo.
    expect((await photoOf(bia)).status).toBe(204);
    expect((await friends.friendRelation({ userId: bia.id })).data?.relation).toBe("sent");

    // Bia sees who is asking.
    as(bia);
    expect((await photoOf(ana)).status).toBe(200);
    await friends.answerFriendRequest({ userId: ana.id, accept: true });
    as(ana);
    expect((await photoOf(bia)).status).toBe(200);

    as(bia);
    await friends.blockUser({ userId: ana.id });
    as(ana);
    expect((await photoOf(bia)).status).toBe(204);

    as(caio);
    expect((await photoOf(bia)).status).toBe(204);
    requestHeaders.current = new Headers();
    expect((await photoOf(bia)).status).toBe(401);
  });

  test("a friend without a photo is an empty answer, cached for a minute", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    as(bia);
    await friends.answerFriendRequest({ userId: ana.id, accept: true });
    as(ana);
    const response = await photoOf(bia);
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await response.text()).toBe("");
  });
});
