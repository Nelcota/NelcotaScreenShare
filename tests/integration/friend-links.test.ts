import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Personal friend links and the lists on the friends page. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friends = await import("@/features/friends/actions.server");
const codes = await import("@/features/friends/code-actions.server");
const links = await import("@/features/friends/server/friend-links.server");
const lists = await import("@/features/friends/server/friend-list.server");
const { friendInvite } = await import("@/features/friends/server/friend-invite.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

describe("friend links", () => {
  test("the link is stable until a new one is made, and then the old one stops working", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const first = await links.friendLinkToken(db, ana.id);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await links.friendLinkToken(db, ana.id)).toBe(first);
    expect(await links.ownerOfFriendLink(db, first)).toBe(ana.id);

    as(ana);
    const rotated = await codes.newFriendCode(undefined);
    const path = rotated.data?.path ?? "";
    const second = path.replace("/amigo/", "");
    expect(second).not.toBe(first);
    expect(await links.ownerOfFriendLink(db, first)).toBeNull();
    expect(await links.ownerOfFriendLink(db, second)).toBe(ana.id);
    expect(await links.ownerOfFriendLink(db, "curto")).toBeNull();
  });
});

describe("friend link after a secret change", () => {
  test("the link shown is brought in line and works", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    await links.friendLinkToken(db, ana.id);
    // Simulates a hash made with another secret.
    await db
      .update(schema.friendLinks)
      .set({ tokenHash: "hash-de-outro-segredo" })
      .where(eq(schema.friendLinks.userId, ana.id));
    const shown = await links.friendLinkToken(db, ana.id);
    expect(await links.ownerOfFriendLink(db, shown)).toBe(ana.id);
  });
});

describe("friends page lists", () => {
  test("splits friends, received, sent and blocked, and relations match", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    const dani = await verifiedParticipant(db, handler, { name: "Dani" });
    const eva = await verifiedParticipant(db, handler, { name: "Eva" });

    as(bia);
    await friends.sendFriendRequest({ userId: ana.id });
    as(ana);
    await friends.sendFriendRequest({ userId: caio.id });
    await friends.blockUser({ userId: dani.id });
    as(eva);
    await friends.sendFriendRequest({ userId: ana.id });
    as(ana);
    await friends.answerFriendRequest({ userId: eva.id, accept: true });

    const page = await lists.friendLists(db, ana.id);
    expect(page.friends.map((person) => person.name)).toEqual(["Eva"]);
    expect(page.received.map((person) => person.name)).toEqual(["Bia"]);
    expect(page.sent.map((person) => person.name)).toEqual(["Caio"]);
    expect(page.blocked.map((person) => person.name)).toEqual(["Dani"]);
    expect(await lists.pendingReceivedCount(db, ana.id)).toBe(1);

    expect(await lists.relationTo(db, ana.id, ana.id)).toBe("self");
    expect(await lists.relationTo(db, ana.id, eva.id)).toBe("friends");
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("received");
    expect(await lists.relationTo(db, ana.id, caio.id)).toBe("sent");
    expect(await lists.relationTo(db, ana.id, dani.id)).toBe("blocked");
    expect(await lists.relationTo(db, bia.id, caio.id)).toBe("none");
    expect((await lists.publicProfile(db, bia.id))?.name).toBe("Bia");
  });
});

describe("friend invite", () => {
  test("shows who sent the link and how the viewer relates to them", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const token = await links.friendLinkToken(db, ana.id);

    const opened = await friendInvite(db, bia.id, token);
    expect(opened).toMatchObject({ status: "open", relation: "none", person: { name: "Ana" } });
    expect(await friendInvite(db, null, token)).toMatchObject({ relation: "none" });
    expect(await friendInvite(db, ana.id, token)).toMatchObject({ relation: "self" });

    as(bia);
    await friends.sendFriendRequest({ userId: ana.id });
    expect(await friendInvite(db, bia.id, token)).toMatchObject({ relation: "sent" });
  });

  test("an unknown or replaced link has expired", async () => {
    expect(await friendInvite(db, null, "x".repeat(43))).toEqual({ status: "expired" });
  });
});
