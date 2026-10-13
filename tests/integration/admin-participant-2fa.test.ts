import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";

const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const { disableParticipantTwoFactorAction } =
  await import("@/features/admin/participants/actions.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

async function participantWithTwoFactor() {
  const [user] = await db
    .insert(schema.users)
    .values({
      name: "Pessoa 2FA",
      email: `dois-fatores-${crypto.randomUUID()}@exemplo.com`,
      twoFactorEnabled: true,
    })
    .returning();
  assert.ok(user);
  await db
    .insert(schema.userTwoFactors)
    .values({ userId: user.id, secret: "segredo-cifrado", backupCodes: "codigos-cifrados" });
  await db.insert(schema.userSessions).values({
    userId: user.id,
    token: `sessao-${crypto.randomUUID()}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return user.id;
}

describe("turning off a participant's 2FA (participant.disableTwoFactor)", () => {
  let owner: Awaited<ReturnType<typeof adminSession>>;
  let admin: Awaited<ReturnType<typeof adminSession>>;
  beforeAll(async () => {
    owner = await adminSession(db, "owner");
    admin = await adminSession(db, "admin");
  });

  test("the owner turns it off: secret gone, sessions ended, audited with the reason", async () => {
    const id = await participantWithTwoFactor();
    requestHeaders.current = owner.headers;

    const result = await disableParticipantTwoFactorAction({ id, reason: "Perdeu o celular" });
    assert.deepEqual(result.data, { sessions: 1 });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    assert.equal(user?.twoFactorEnabled, false);
    const secrets = await db
      .select()
      .from(schema.userTwoFactors)
      .where(eq(schema.userTwoFactors.userId, id));
    assert.equal(secrets.length, 0);
    const sessions = await db
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.userId, id));
    assert.equal(sessions.length, 0);

    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, id));
    assert.equal(audit?.action, "user.two_factor_disable");
    assert.equal(audit?.actorAdminId, owner.id);
    assert.deepEqual(audit?.metadata, { motivo: "Perdeu o celular", sessoes: 1 });

    const again = await disableParticipantTwoFactorAction({ id, reason: "De novo" });
    assert.equal(again.serverError, "Essa conta não usa verificação em duas etapas.");
  });

  test("an admin cannot, and nothing changes", async () => {
    const id = await participantWithTwoFactor();
    requestHeaders.current = admin.headers;
    const result = await disableParticipantTwoFactorAction({ id, reason: "Perdeu o celular" });
    assert.equal(result.serverError, "Você não tem permissão para fazer isso.");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    assert.equal(user?.twoFactorEnabled, true);
  });
});
