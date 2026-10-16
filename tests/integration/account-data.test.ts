import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, test, vi } from "vitest";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";
import { makeCaller } from "./support/http-auth";
import { totpFromUri } from "./support/totp";

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
  conta: z.object({ id: z.string(), email_confirmado: z.boolean(), criada_em: z.string() }),
  participacoes_em_salas: z.array(
    z.object({
      sala: z.string(),
      nome_na_sala: z.string().nullable(),
      ip: z.string().nullable(),
      compartilhamentos: z.number(),
    }),
  ),
  pedidos_de_entrada: z.array(z.object({ sala: z.string(), resultado: z.string() })),
});

const roomDataSchema = z.object({
  salas_criadas: z.array(z.object({ sala: z.string() })),
  papeis_em_salas: z.array(z.object({ sala: z.string(), papel: z.string() })),
  banimentos_de_chamadas: z.array(z.object({ sala: z.string() })),
});

async function plainAccount(name: string) {
  const [account] = await db
    .insert(schema.users)
    .values({ name, email: `${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(account);
  return account.id;
}

async function deleteAccountOf(participant: { password: string; jar: { header(): string } }) {
  requestHeaders.current = new Headers({ cookie: participant.jar.header() });
  const result = await deleteMyAccount({ password: participant.password });
  assert.equal(result.serverError, undefined, JSON.stringify(result));
}

const rolesIn = (roomCode: string) =>
  db
    .select({ userId: schema.roomRoles.userId, role: schema.roomRoles.role })
    .from(schema.roomRoles)
    .where(eq(schema.roomRoles.roomCode, roomCode));

/** A participant with two-step verification on, signed in for the operations. */
async function withTwoFactor() {
  const person = await verifiedParticipant(db, handler);
  const call = makeCaller(handler, "/api/auth", "192.0.2.90");
  const enabled = await call("/two-factor/enable", {
    body: { password: person.password },
    jar: person.jar,
  });
  const setup = z
    .object({ totpURI: z.string(), backupCodes: z.array(z.string()) })
    .parse(enabled.body);
  const verified = await call("/two-factor/verify-totp", {
    body: { code: totpFromUri(setup.totpURI) },
    jar: person.jar,
  });
  assert.equal(verified.status, 200);
  requestHeaders.current = new Headers({ cookie: person.jar.header() });
  return { person, setup };
}
const deletedAt = async (id: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]?.deletedAt ?? null;

describe("data subject data", () => {
  test("the export lists the rooms the person created, their roles and their bans", async () => {
    const participant = await verifiedParticipant(db, handler);
    const stamp = Date.now().toString(36);
    const created = `criada-${stamp}`;
    const other = `outra-${stamp}`;
    await db
      .insert(schema.roomDefinitions)
      .values([{ code: created, ownerUserId: participant.id }, { code: other }]);
    await db.insert(schema.roomRoles).values([
      { roomCode: created, userId: participant.id, role: "owner" },
      { roomCode: other, userId: participant.id, role: "moderator" },
    ]);
    await db
      .insert(schema.roomBans)
      .values({ roomCode: other, identity: participant.id, livekitRoomSid: "RM_lgpd" });
    requestHeaders.current = new Headers({ cookie: participant.jar.header() });
    const data = roomDataSchema.parse(await (await downloadAccountData()).json());
    assert.deepEqual(
      data.salas_criadas.map((row) => row.sala),
      [created],
    );
    const roles = new Map(data.papeis_em_salas.map((row) => [row.sala, row.papel]));
    assert.equal(roles.size, 2);
    assert.equal(roles.get(created), "dono");
    assert.equal(roles.get(other), "moderador");
    assert.deepEqual(
      data.banimentos_de_chamadas.map((row) => row.sala),
      [other],
    );
  });

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
      data.participacoes_em_salas.map(({ sala, nome_na_sala, ip, compartilhamentos }) => ({
        sala,
        nome_na_sala,
        ip,
        compartilhamentos,
      })),
      [{ sala: code, nome_na_sala: "Nome Na Sala", ip: "203.0.113.20", compartilhamentos: 1 }],
    );
    assert.deepEqual(
      data.pedidos_de_entrada.map((row) => [row.sala, row.resultado]),
      [[code, "aceito"]],
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

  test("deleting the account hands an owned room to its oldest moderator", async () => {
    const owner = await verifiedParticipant(db, handler);
    const oldest = await plainAccount("Moderadora Antiga");
    const newer = await plainAccount("Moderador Novo");
    const code = `heranca-${Date.now().toString(36)}`;
    await db.insert(schema.roomDefinitions).values({ code, ownerUserId: owner.id });
    await db.insert(schema.roomRoles).values([
      { roomCode: code, userId: owner.id, role: "owner" },
      {
        roomCode: code,
        userId: newer,
        role: "moderator",
        grantedByUserId: owner.id,
        createdAt: new Date(Date.now() - 60_000),
      },
      {
        roomCode: code,
        userId: oldest,
        role: "moderator",
        grantedByUserId: owner.id,
        createdAt: new Date(Date.now() - 120_000),
      },
    ]);
    await db.insert(schema.roomSettings).values({ roomCode: code, updatedByUserId: owner.id });
    await db.insert(schema.rooms).values({ code, createdByUserId: owner.id });

    await deleteAccountOf(owner);

    const roles = new Map((await rolesIn(code)).map((row) => [row.userId, row.role]));
    assert.equal(roles.size, 2);
    assert.equal(roles.get(oldest), "owner");
    assert.equal(roles.get(newer), "moderator");
    const [definition] = await db
      .select()
      .from(schema.roomDefinitions)
      .where(eq(schema.roomDefinitions.code, code));
    assert.equal(definition?.ownerUserId, oldest);
    const [settings] = await db
      .select()
      .from(schema.roomSettings)
      .where(eq(schema.roomSettings.roomCode, code));
    assert.equal(settings?.updatedByUserId, null);
    const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.code, code));
    assert.equal(room?.createdByUserId, null);
    const granted = await db
      .select()
      .from(schema.roomRoles)
      .where(eq(schema.roomRoles.grantedByUserId, owner.id));
    assert.deepEqual(granted, []);
  });

  test("deleting the account removes an owned room with no moderator and its roles elsewhere", async () => {
    const owner = await verifiedParticipant(db, handler);
    const otherOwner = await plainAccount("Dona Da Outra");
    const stamp = Date.now().toString(36);
    const solo = `sozinha-${stamp}`;
    const other = `alheia-${stamp}`;
    await db.insert(schema.roomDefinitions).values([
      { code: solo, ownerUserId: owner.id },
      { code: other, ownerUserId: otherOwner },
    ]);
    await db.insert(schema.roomRoles).values([
      { roomCode: solo, userId: owner.id, role: "owner" },
      { roomCode: other, userId: otherOwner, role: "owner" },
      { roomCode: other, userId: owner.id, role: "moderator", grantedByUserId: otherOwner },
    ]);
    await db.insert(schema.roomSettings).values({ roomCode: solo, access: "approval" });
    await db.insert(schema.roomJoinRequests).values({
      roomCode: solo,
      guestId: crypto.randomUUID(),
      displayName: "Visita",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.insert(schema.roomBans).values([
      { roomCode: solo, identity: "convidado-x", livekitRoomSid: "RM_solo" },
      { roomCode: other, identity: "convidado-y", livekitRoomSid: "RM_other" },
    ]);

    await deleteAccountOf(owner);

    const codes = await db
      .select({ code: schema.roomDefinitions.code })
      .from(schema.roomDefinitions)
      .where(inArray(schema.roomDefinitions.code, [solo, other]));
    assert.deepEqual(
      codes.map((row) => row.code),
      [other],
    );
    assert.deepEqual(await rolesIn(solo), []);
    assert.deepEqual(await rolesIn(other), [{ userId: otherOwner, role: "owner" }]);
    const settings = await db
      .select()
      .from(schema.roomSettings)
      .where(eq(schema.roomSettings.roomCode, solo));
    assert.deepEqual(settings, []);
    const requests = await db
      .select()
      .from(schema.roomJoinRequests)
      .where(eq(schema.roomJoinRequests.roomCode, solo));
    assert.deepEqual(requests, []);
    const bans = await db
      .select({ roomCode: schema.roomBans.roomCode })
      .from(schema.roomBans)
      .where(inArray(schema.roomBans.roomCode, [solo, other]));
    assert.deepEqual(bans, [{ roomCode: other }]);
  });

  test("deleting an account removes its join request names in other people's rooms", async () => {
    const requester = await verifiedParticipant(db, handler);
    const owner = await plainAccount("Dona Da Sala");
    const code = `pedidos-${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(schema.roomDefinitions).values({ code, ownerUserId: owner });
    await db.insert(schema.roomJoinRequests).values([
      {
        roomCode: code,
        userId: requester.id,
        displayName: "Nome Pessoal No Pedido",
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        roomCode: code,
        guestId: crypto.randomUUID(),
        displayName: "Outra Pessoa",
        status: "accepted",
        decidedByUserId: requester.id,
        decidedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    await deleteAccountOf(requester);

    const requests = await db
      .select()
      .from(schema.roomJoinRequests)
      .where(eq(schema.roomJoinRequests.roomCode, code));
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.displayName, "Outra Pessoa");
    assert.equal(requests[0]?.decidedByUserId, null);
  });

  test("deleting the account archives an owned room the host controls kept calls of", async () => {
    const owner = await verifiedParticipant(db, handler);
    const code = `com-chamadas-${Date.now().toString(36)}`;
    const [definition] = await db
      .insert(schema.roomDefinitions)
      .values({ code, ownerUserId: owner.id })
      .returning({ id: schema.roomDefinitions.id });
    assert.ok(definition);
    await db.insert(schema.roomRoles).values({ roomCode: code, userId: owner.id, role: "owner" });
    await db.insert(schema.roomSettings).values({ roomCode: code, access: "approval" });
    await db.insert(schema.roomSessions).values({
      definitionId: definition.id,
      mediaRoomName: `nelcota-${crypto.randomUUID()}`,
      status: "closed",
    });

    await deleteAccountOf(owner);

    const [archived] = await db
      .select()
      .from(schema.roomDefinitions)
      .where(eq(schema.roomDefinitions.code, code));
    assert.equal(archived?.ownerUserId, null);
    assert.notEqual(archived?.archivedAt, null);
    assert.deepEqual(await rolesIn(code), []);
    const settings = await db
      .select()
      .from(schema.roomSettings)
      .where(eq(schema.roomSettings.roomCode, code));
    assert.deepEqual(settings, []);
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

  test("with two-step verification on, deleting also asks for a code from the app or a backup", async () => {
    const { person: ana, setup } = await withTwoFactor();
    const withoutCode = await deleteMyAccount({ password: ana.password });
    assert.equal(withoutCode.serverError, "Digite o código de duas etapas para confirmar.");
    const wrongCode = await deleteMyAccount({ password: ana.password, code: "000000" });
    assert.equal(wrongCode.serverError, "Código inválido. Confira e tente de novo.");
    assert.equal(await deletedAt(ana.id), null);
    const deleted = await deleteMyAccount({
      password: ana.password,
      code: totpFromUri(setup.totpURI),
    });
    assert.equal(deleted.serverError, undefined);
    assert.notEqual(await deletedAt(ana.id), null);

    const { person: bia, setup: biaSetup } = await withTwoFactor();
    const backup = biaSetup.backupCodes[0];
    assert(backup);
    const withBackup = await deleteMyAccount({ password: bia.password, code: backup });
    assert.equal(withBackup.serverError, undefined);
    assert.notEqual(await deletedAt(bia.id), null);
  });
});
