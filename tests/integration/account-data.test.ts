import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, test, vi } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";
import { makeCaller } from "./support/http-auth";

/**
 * Data subject rights (LGPD): "download my data" includes the room history
 * and deleting the account removes the name from participations.
 */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
vi.mock("@/server/http.server", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { downloadAccountData } = await import("@/features/account/server/data-export-route.server");
const { deleteMyAccount } = await import("@/features/account/actions.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

async function withHistory(userId: string) {
  const code = `sala-lgpd-${Date.now().toString(36)}`;
  const [room] = await db.insert(schema.rooms).values({ code }).returning();
  assert.ok(room);
  const [participation] = await db
    .insert(schema.roomParticipations)
    .values({
      roomId: room.id,
      userId,
      livekitIdentity: userId,
      livekitSid: `PA_${crypto.randomUUID()}`,
      displayName: "Nome Na Sala",
      ip: "203.0.113.20",
      joinedAt: new Date(Date.now() - 60_000),
      leftAt: new Date(),
    })
    .returning();
  assert.ok(participation);
  await db.insert(schema.shareSessions).values({
    roomId: room.id,
    participationId: participation.id,
    trackSid: `TR_${crypto.randomUUID()}`,
    startedAt: new Date(Date.now() - 30_000),
    endedAt: new Date(),
  });
  await db.insert(schema.tokenRequests).values({
    roomCode: code,
    roomId: room.id,
    userId,
    result: "granted",
    ip: "203.0.113.20",
  });
  return { code, participationId: participation.id };
}

const exportSchema = z.object({
  conta: z.object({ id: z.string() }),
  participacoes_em_salas: z.array(
    z.object({
      sala: z.string(),
      nomeNaSala: z.string().nullable(),
      ip: z.string().nullable(),
      compartilhamentos: z.number(),
    }),
  ),
  pedidos_de_entrada: z.array(z.object({ sala: z.string(), resultado: z.string() })),
});

describe("data subject data", () => {
  test("the export includes the entire history beyond 5,000 rows", async () => {
    const participant = await verifiedParticipant(db, handler);
    const { code } = await withHistory(participant.id);
    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.code, code) });
    assert.ok(room);
    await pool.query(
      `
      insert into room_participations (room_id, user_id, livekit_identity, livekit_sid, joined_at, left_at)
      select $1::uuid, $2::uuid, $2::uuid::text, 'PA_export_' || $2::uuid::text || '_' || g,
        now() - g * interval '1 second', now()
      from generate_series(1, 5000) as g`,
      [room.id, participant.id],
    );
    await pool.query(
      `
      insert into token_requests (room_code, user_id, result, created_at)
      select $1, $2, 'granted', now() - g * interval '1 second'
      from generate_series(1, 5000) as g`,
      [code, participant.id],
    );
    requestHeaders.current = new Headers({ cookie: participant.jar.header() });
    const response = await downloadAccountData();
    assert.equal(response.status, 200);
    const data = exportSchema.parse(await response.json());
    assert.equal(data.participacoes_em_salas.length, 5001);
    assert.equal(data.pedidos_de_entrada.length, 5001);
  });

  test("deletion invalidates pending recoveries and rejects leftover tokens", async () => {
    const user = await verifiedParticipant(db, handler);
    const auth = await getUserAuth().$context;
    const token = crypto.randomUUID();
    const identifier = `reset-password:${token}`;
    const recovery = { identifier, value: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) };
    await auth.internalAdapter.createVerificationValue(recovery);
    requestHeaders.current = new Headers({ cookie: user.jar.header() });
    const deleted = await deleteMyAccount({ password: user.password });
    assert.equal(deleted.serverError, undefined);
    assert.equal(await auth.internalAdapter.findVerificationValue(identifier), null);
    const call = makeCaller(handler, "/api/auth", "192.0.2.79");
    const body = { token, newPassword: "nova-senha-forte-123" };
    assert.equal((await call("/reset-password", { body })).status, 400);
    // Covers legacy tokens or ones written by a request concurrent with the deletion.
    await auth.internalAdapter.createVerificationValue(recovery);
    assert.equal((await call("/reset-password", { body })).status, 400);
    assert.equal(
      (await call(`/reset-password?token=${token}`, { body: { newPassword: body.newPassword } }))
        .status,
      400,
    );
    assert.equal(
      await db.query.userAccounts.findFirst({ where: eq(schema.userAccounts.userId, user.id) }),
      undefined,
    );
  });

  test("password recovery keeps working for an active account", async () => {
    const user = await verifiedParticipant(db, handler);
    const auth = await getUserAuth().$context;
    const token = crypto.randomUUID();
    await auth.internalAdapter.createVerificationValue({
      identifier: `reset-password:${token}`,
      value: user.id,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const call = makeCaller(handler, "/api/auth", "192.0.2.80");
    const newPassword = "nova-senha-ativa-123";
    assert.equal((await call("/reset-password", { body: { token, newPassword } })).status, 200);
    assert.equal(
      (await call("/sign-in/email", { body: { email: user.email, password: newPassword } })).status,
      200,
    );
  });

  test("the export includes rooms, screen shares and join requests", async () => {
    const lia = await verifiedParticipant(db, handler);
    const { code } = await withHistory(lia.id);
    requestHeaders.current = new Headers({ cookie: lia.jar.header() });
    const response = await downloadAccountData();
    assert.equal(response.status, 200);
    const data = exportSchema.parse(await response.json());
    assert.equal(data.conta.id, lia.id);
    assert.deepEqual(
      data.participacoes_em_salas.map(({ sala, nomeNaSala, ip, compartilhamentos }) => ({
        sala,
        nomeNaSala,
        ip,
        compartilhamentos,
      })),
      [{ sala: code, nomeNaSala: "Nome Na Sala", ip: "203.0.113.20", compartilhamentos: 1 }],
    );
    assert.deepEqual(
      data.pedidos_de_entrada.map((row) => [row.sala, row.resultado]),
      [[code, "granted"]],
    );
  });

  test("deleting the account erases the name from participations and keeps the access record", async () => {
    const leo = await verifiedParticipant(db, handler);
    const { participationId } = await withHistory(leo.id);
    requestHeaders.current = new Headers({
      cookie: leo.jar.header(),
      "x-client-ip": "192.0.2.77",
    });
    const result = await deleteMyAccount({ password: leo.password });
    assert.equal(result.serverError, undefined, JSON.stringify(result));
    const [row] = await db
      .select()
      .from(schema.roomParticipations)
      .where(eq(schema.roomParticipations.id, participationId));
    assert.equal(row?.displayName, null);
    assert.equal(row?.ip, "203.0.113.20");
    assert.equal(row?.userId, leo.id);
  });

  test("a wrong password on deletion has a per-account attempt limit", async () => {
    const ana = await verifiedParticipant(db, handler);
    requestHeaders.current = new Headers({ cookie: ana.jar.header() });
    for (let attempt = 0; attempt < 5; attempt++) {
      const wrong = await deleteMyAccount({ password: "senha-errada-123" });
      assert.equal(wrong.serverError, "Senha incorreta.");
    }
    const blocked = await deleteMyAccount({ password: ana.password });
    assert.match(String(blocked.serverError), /Muitas tentativas/);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ana.id));
    assert.equal(user?.deletedAt, null, "the account stays active");
  });
});
