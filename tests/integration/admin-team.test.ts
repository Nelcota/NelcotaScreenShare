import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";

/** /admin/equipe: the owner invites, deactivates, reactivates and ends sessions, audited. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const team = await import("@/features/admin/team/actions.server");
const { listTeam, listPendingInvitations } =
  await import("@/features/admin/team/server/queries.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

type Session = Awaited<ReturnType<typeof adminSession>>;
let owner: Session;
let otherOwner: Session;
beforeAll(async () => {
  owner = await adminSession(db, "owner");
  otherOwner = await adminSession(db, "owner");
});

const DENIED = "Você não tem permissão para fazer isso.";

async function auditOf(action: string, resourceId: string) {
  return db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.action, action), eq(schema.auditLogs.resourceId, resourceId)));
}

async function sessionsOf(userId: string) {
  return db.select().from(schema.adminSessions).where(eq(schema.adminSessions.userId, userId));
}

describe("invitations", () => {
  test("the owner invites an admin; the link is returned once and audited", async () => {
    requestHeaders.current = owner.headers;
    const email = `novo-${Date.now()}@exemplo.com`;
    const result = await team.inviteAdminAction({ email, role: "admin" });
    assert.match(result.data?.link ?? "", /\/admin\/convite\//);
    const pending = await listPendingInvitations(db);
    const invitation = pending.find((row) => row.email === email);
    assert.equal(invitation?.role, "admin");
    assert.ok(invitation && (await auditOf("admin_invitation.create", invitation.id)).length);

    const revoked = await team.revokeAdminInvitationAction({ id: invitation.id });
    assert.deepEqual(revoked.data, { revoked: true });
    assert.equal(
      (await listPendingInvitations(db)).some((row) => row.email === email),
      false,
    );
  });

  test("an e-mail that already has access and an owner role cannot be invited", async () => {
    requestHeaders.current = owner.headers;
    const [existing] = await db
      .select({ email: schema.adminUsers.email })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, otherOwner.id));
    assert.ok(existing);
    const again = await team.inviteAdminAction({ email: existing.email, role: "viewer" });
    assert.equal(again.serverError, "Esse e-mail já tem acesso ao painel.");
    const asOwner = await team.inviteAdminAction({
      email: "dono-novo@exemplo.com",
      role: "owner" as "admin",
    });
    assert.ok(asOwner.validationErrors);
  });

  test("an admin and a reader cannot manage the team", async () => {
    for (const role of ["admin", "viewer"] as const) {
      const session = await adminSession(db, role);
      requestHeaders.current = session.headers;
      const result = await team.inviteAdminAction({ email: "x@exemplo.com", role: "viewer" });
      assert.equal(result.serverError, DENIED);
      const deactivate = await team.deactivateAdminAction({ id: owner.id, reason: "Motivo" });
      assert.equal(deactivate.serverError, DENIED);
    }
  });
});

describe("access", () => {
  test("deactivating ends the sessions, locks the account and is audited with the reason", async () => {
    const member = await adminSession(db, "admin");
    requestHeaders.current = owner.headers;
    const result = await team.deactivateAdminAction({ id: member.id, reason: "Conta vazada" });
    assert.ok(result.data && result.data.sessions >= 1);
    assert.equal((await sessionsOf(member.id)).length, 0);
    const [audit] = await auditOf("admin_user.deactivate", member.id);
    assert.ok(audit);
    assert.equal((audit.metadata as { motivo?: string }).motivo, "Conta vazada");
    const listed = (await listTeam(db)).find((row) => row.id === member.id);
    assert.equal(listed?.active, false);

    // The old session no longer opens the panel.
    requestHeaders.current = member.headers;
    const blocked = await team.inviteAdminAction({ email: "y@exemplo.com", role: "viewer" });
    assert.equal(blocked.serverError, "Sua sessão expirou. Entre de novo.");

    requestHeaders.current = owner.headers;
    const back = await team.reactivateAdminAction({ id: member.id, reason: "Senha trocada" });
    assert.deepEqual(back.data, { reactivated: true });
    assert.equal((await listTeam(db)).find((row) => row.id === member.id)?.active, true);
    assert.equal((await auditOf("admin_user.reactivate", member.id)).length, 1);
  });

  test("ending sessions signs the person out everywhere, audited", async () => {
    const member = await adminSession(db, "viewer");
    requestHeaders.current = owner.headers;
    const result = await team.endAdminSessionsAction({ id: member.id, reason: "Aparelho perdido" });
    assert.ok(result.data && result.data.sessions >= 1);
    assert.equal((await sessionsOf(member.id)).length, 0);
    assert.equal((await auditOf("admin_user.sessions_revoke", member.id)).length, 1);
  });

  test("nobody changes their own account or an owner here; a reason is required", async () => {
    requestHeaders.current = owner.headers;
    const self = await team.deactivateAdminAction({ id: owner.id, reason: "Teste" });
    assert.equal(self.serverError, "A sua própria conta não muda por aqui.");
    const another = await team.endAdminSessionsAction({ id: otherOwner.id, reason: "Teste" });
    assert.equal(another.serverError, "Donos não mudam por aqui.");
    const member = await adminSession(db, "admin");
    const noReason = await team.deactivateAdminAction({ id: member.id, reason: "x" });
    assert.ok(noReason.validationErrors);
  });
});
