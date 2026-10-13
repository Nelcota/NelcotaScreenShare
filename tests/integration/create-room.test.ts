import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** "Criar sala" as the home page calls it: a signed-in account becomes the owner. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const { createRoomAction } = await import("@/features/room/actions.server");
const { roomExists } = await import("@/features/room/server/room-codes.server");
const { roomRoleOf } = await import("@/features/room/server/room-roles.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

test("creates the room, makes the account its owner and returns its path", async () => {
  const ana = await verifiedParticipant(db, handler);
  requestHeaders.current = new Headers({ cookie: ana.jar.header() });
  const result = await createRoomAction(undefined);
  const path = result.data?.path ?? "";
  const code = path.replace("/sala/", "");
  assert.match(path, /^\/sala\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/);
  assert.equal(await roomExists(db, code), true);
  assert.equal(await roomRoleOf(db, { roomCode: code, userId: ana.id }), "owner");
});

test("an account creating rooms in a row is stopped after 10", async () => {
  const bia = await verifiedParticipant(db, handler);
  requestHeaders.current = new Headers({ cookie: bia.jar.header() });
  for (let room = 0; room < 10; room++) {
    assert.ok((await createRoomAction(undefined)).data);
  }
  const blocked = await createRoomAction(undefined);
  assert.equal(blocked.serverError, "Você criou muitas salas agora. Aguarde alguns minutos.");
});

test("with e-mail confirmation on, an unconfirmed account cannot create rooms", async () => {
  const caio = await verifiedParticipant(db, handler);
  await db.update(schema.users).set({ emailVerified: false }).where(eq(schema.users.id, caio.id));
  requestHeaders.current = new Headers({ cookie: caio.jar.header() });
  const refused = await createRoomAction(undefined);
  assert.equal(
    refused.serverError,
    "Confirme seu e-mail para criar salas. O link está na sua caixa de entrada.",
  );
});
