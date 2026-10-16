import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { roomJoinRequests } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Asking to enter a room with approval, and the owner or a moderator answering. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const room = await import("@/features/room/actions.server");
const requests = await import("@/features/room/server/join-requests.server");
const { createRoom } = await import("@/features/room/server/room-codes.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

/** Opens (or reuses) a request that must exist. */
async function openRequest(
  database: typeof db,
  input: Parameters<typeof requests.openJoinRequest>[1],
): Promise<string> {
  const id = await requests.openJoinRequest(database, input);
  if (!id) throw new Error("request not opened");
  return id;
}

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

describe("join requests", () => {
  test("one pending request per person, answered by the owner, admitting once", async () => {
    const owner = await verifiedParticipant(db, handler, { name: "Dona" });
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const code = await createRoom(db, owner.id);
    const requester = { userId: ana.id };

    const first = await openRequest(db, {
      roomCode: code,
      requester,
      displayName: "Ana",
    });
    const again = await openRequest(db, {
      roomCode: code,
      requester,
      displayName: "Ana",
    });
    expect(again).toBe(first);
    expect(await requests.joinRequestStatus(db, { requestId: first, requester })).toBe("pending");

    as(ana);
    expect(
      (await room.answerJoin({ room: code, requestId: first, accept: true })).serverError,
    ).toBe("Só o dono e os moderadores respondem aos pedidos.");
    expect((await room.joinRequests({ room: code })).serverError).toBeDefined();

    as(owner);
    expect(await room.joinRequests({ room: code })).toEqual({
      data: { requests: [{ id: first, name: "Ana", guest: false }] },
    });
    expect(await room.answerJoin({ room: code, requestId: first, accept: true })).toEqual({
      data: { accepted: true },
    });
    expect(
      (await room.answerJoin({ room: code, requestId: first, accept: false })).serverError,
    ).toBe("Esse pedido já foi respondido ou expirou.");
    expect(await requests.joinRequestStatus(db, { requestId: first, requester })).toBe("accepted");

    const other = { userId: owner.id };
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester: other, requestId: first }),
    ).toBeNull();
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester, requestId: first }),
    ).toBe(first);
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester, requestId: first }),
    ).toBeNull();
    // Signing the token failed: the approval goes back and lets the person in later.
    await requests.restoreApproval(db, first);
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester, requestId: first }),
    ).toBe(first);
  });

  test("a guest asks by the cookie id; declined and lapsed requests say so", async () => {
    const owner = await verifiedParticipant(db, handler, { name: "Dono" });
    const code = await createRoom(db, owner.id);
    const guest = { guestId: crypto.randomUUID() };

    const declined = await openRequest(db, {
      roomCode: code,
      requester: guest,
      displayName: "Visita",
    });
    expect(await requests.pendingJoinRequests(db, code)).toEqual([
      { id: declined, name: "Visita", guest: true },
    ]);
    await requests.answerJoinRequest(db, {
      roomCode: code,
      requestId: declined,
      deciderId: owner.id,
      accept: false,
    });
    expect(await requests.joinRequestStatus(db, { requestId: declined, requester: guest })).toBe(
      "declined",
    );

    const lapsed = await openRequest(db, {
      roomCode: code,
      requester: guest,
      displayName: "Visita",
    });
    expect(lapsed).not.toBe(declined);
    await db
      .update(roomJoinRequests)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(roomJoinRequests.id, lapsed));
    expect(await requests.joinRequestStatus(db, { requestId: lapsed, requester: guest })).toBe(
      "expired",
    );
    expect(await requests.pendingJoinRequests(db, code)).toEqual([]);
    expect(
      await requests.answerJoinRequest(db, {
        roomCode: code,
        requestId: lapsed,
        deciderId: owner.id,
        accept: true,
      }),
    ).toBe(false);

    const fresh = await openRequest(db, {
      roomCode: code,
      requester: guest,
      displayName: "Visita",
    });
    expect(fresh).not.toBe(lapsed);
    expect(
      await requests.joinRequestStatus(db, {
        requestId: fresh,
        requester: { guestId: crypto.randomUUID() },
      }),
    ).toBeNull();
  });

  test("joining again without the request id uses the approval, once", async () => {
    const owner = await verifiedParticipant(db, handler, { name: "Dona" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const code = await createRoom(db, owner.id);
    const requester = { userId: bia.id };
    const id = await openRequest(db, {
      roomCode: code,
      requester,
      displayName: "Bia",
    });
    await requests.answerJoinRequest(db, {
      roomCode: code,
      requestId: id,
      deciderId: owner.id,
      accept: true,
    });

    const stranger = { userId: owner.id };
    expect(
      await requests.consumeApproval(db, {
        roomCode: code,
        requester: stranger,
        requestId: undefined,
      }),
    ).toBeNull();
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester, requestId: undefined }),
    ).toBe(id);
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester, requestId: undefined }),
    ).toBeNull();
    expect(
      await requests.consumeApproval(db, { roomCode: code, requester, requestId: id }),
    ).toBeNull();
  });

  test("a full queue or the caller's limit stops new requests, not existing ones", async () => {
    const owner = await verifiedParticipant(db, handler, { name: "Dona" });
    const code = await createRoom(db, owner.id);
    const firstGuest = crypto.randomUUID();
    const first = await openRequest(db, {
      roomCode: code,
      requester: { guestId: firstGuest },
      displayName: "Visita",
    });
    // The caller's limit only matters for a new request.
    expect(
      await requests.openJoinRequest(db, {
        roomCode: code,
        requester: { guestId: firstGuest },
        displayName: "Visita",
        mayOpen: () => false,
      }),
    ).toBe(first);
    expect(
      await requests.openJoinRequest(db, {
        roomCode: code,
        requester: { guestId: crypto.randomUUID() },
        displayName: "Visita",
        mayOpen: () => false,
      }),
    ).toBeNull();
    // A queue the host can still read through.
    expect(requests.MAX_PENDING_PER_ROOM).toBe(15);
    for (let index = 1; index < requests.MAX_PENDING_PER_ROOM; index++) {
      await openRequest(db, {
        roomCode: code,
        requester: { guestId: crypto.randomUUID() },
        displayName: "Visita",
      });
    }
    expect(
      await requests.openJoinRequest(db, {
        roomCode: code,
        requester: { guestId: crypto.randomUUID() },
        displayName: "Visita",
      }),
    ).toBeNull();
  });
});
