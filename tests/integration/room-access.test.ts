import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Open entry or entry with approval: only the owner and moderators choose. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const room = await import("@/features/room/actions.server");
const { createRoom } = await import("@/features/room/server/room-codes.server");
const { awaitsApproval, roomAccessOf } = await import("@/features/room/server/room-access.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

describe("room access", () => {
  test("the owner and moderators switch it; a participant only reads it", async () => {
    const owner = await verifiedParticipant(db, handler, { name: "Dona" });
    const moderator = await verifiedParticipant(db, handler, { name: "Moderadora" });
    const guest = await verifiedParticipant(db, handler, { name: "Visita" });
    const code = await createRoom(db, owner.id);
    await db
      .insert(schema.roomRoles)
      .values({ roomCode: code, userId: moderator.id, role: "moderator" });

    expect(await roomAccessOf(db, code)).toBe("open");
    as(owner);
    expect(await room.roomAccess({ room: code })).toEqual({
      data: { access: "open", canManage: true },
    });
    expect(await room.setRoomAccess({ room: code, access: "approval" })).toEqual({
      data: { access: "approval" },
    });
    expect(await roomAccessOf(db, code)).toBe("approval");

    as(moderator);
    expect(await room.setRoomAccess({ room: code, access: "open" })).toEqual({
      data: { access: "open" },
    });

    as(guest);
    expect(await room.roomAccess({ room: code })).toEqual({
      data: { access: "open", canManage: false },
    });
    expect((await room.setRoomAccess({ room: code, access: "approval" })).serverError).toBe(
      "Só o dono e os moderadores mudam a entrada da sala.",
    );
    expect(await roomAccessOf(db, code)).toBe("open");
    expect(
      (await room.setRoomAccess({ room: "sala-que-nao-existe", access: "open" })).serverError,
    ).toBe("Esta sala não existe.");
  });

  test("with approval, only the owner and moderators see who is inside before entering", async () => {
    const owner = await verifiedParticipant(db, handler, { name: "Dona" });
    const moderator = await verifiedParticipant(db, handler, { name: "Moderadora" });
    const visitor = await verifiedParticipant(db, handler, { name: "Visita" });
    const code = await createRoom(db, owner.id);
    await db
      .insert(schema.roomRoles)
      .values({ roomCode: code, userId: moderator.id, role: "moderator" });

    expect(await awaitsApproval(db, code, visitor.id)).toBe(false);
    as(owner);
    await room.setRoomAccess({ room: code, access: "approval" });
    expect(await awaitsApproval(db, code, visitor.id)).toBe(true);
    expect(await awaitsApproval(db, code, owner.id)).toBe(false);
    expect(await awaitsApproval(db, code, moderator.id)).toBe(false);
  });
});
