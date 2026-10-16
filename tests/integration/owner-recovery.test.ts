import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import {
  ADMIN_AUTH_BASE_PATH,
  createAdminAuthForTests,
} from "@/features/auth/server/admin-auth.server";
import {
  acceptAdminInvitation,
  createAdminInvitation,
} from "@/features/auth/server/admin-invitations.server";
import { startOwnerRecovery } from "@/features/auth/server/owner-recovery.server";
import * as schema from "@/server/db/schema";
import { CookieJar, makeCaller } from "./support/http-auth";

/** `create-owner --force` on an owner who lost their 2FA: the same account comes back. */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const auth = createAdminAuthForTests(db, "segredo-admin-de-teste-0123456789abcdef0123456789");
const OLD_PASSWORD = "senha-antiga-do-dono-1";
const NEW_PASSWORD = "senha-nova-do-dono-2";
let nextIp = 1;
const signIn = (email: string, password: string) =>
  makeCaller(
    auth.handler,
    ADMIN_AUTH_BASE_PATH,
    `198.51.100.${nextIp++}`,
  )("/sign-in/email", {
    body: { email, password },
    jar: new CookieJar(),
  });

async function ownerWithTwoFactorAndSession(email: string) {
  const { token } = await createAdminInvitation(db, { email, role: "owner", invitedBy: null });
  const accepted = await acceptAdminInvitation(db, auth, {
    token,
    name: "Dona",
    password: OLD_PASSWORD,
  });
  assert.ok(accepted.ok);
  await db
    .update(schema.adminUsers)
    .set({ twoFactorEnabled: true })
    .where(eq(schema.adminUsers.id, accepted.userId));
  await db.insert(schema.adminTwoFactors).values({
    userId: accepted.userId,
    secret: "segredo-perdido",
    backupCodes: "codigos-perdidos",
  });
  await signIn(email, OLD_PASSWORD);
  return accepted.userId;
}

test("--force on an existing owner locks the account, ends sessions and drops 2FA", async () => {
  const email = "dona-perdida@exemplo.com";
  const userId = await ownerWithTwoFactorAndSession(email);
  const recovery = await startOwnerRecovery(db, email);
  assert.ok(recovery);

  const [account] = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, userId));
  assert.equal(account?.banned, true);
  assert.equal(account?.twoFactorEnabled, false);
  const sessions = await db
    .select()
    .from(schema.adminSessions)
    .where(eq(schema.adminSessions.userId, userId));
  assert.equal(sessions.length, 0);
  const factors = await db
    .select()
    .from(schema.adminTwoFactors)
    .where(eq(schema.adminTwoFactors.userId, userId));
  assert.equal(factors.length, 0);
  const [audit] = await db
    .select()
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.action, "admin.recovery_start"),
        eq(schema.auditLogs.resourceId, userId),
      ),
    );
  assert.ok(audit);
  // The old password no longer opens the panel.
  assert.notEqual((await signIn(email, OLD_PASSWORD)).status, 200);
});

test("the recovery invitation brings the same account back with a new password and no 2FA", async () => {
  const email = "dona-volta@exemplo.com";
  const userId = await ownerWithTwoFactorAndSession(email);
  const recovery = await startOwnerRecovery(db, email);
  assert.ok(recovery);

  const accepted = await acceptAdminInvitation(db, auth, {
    token: recovery.token,
    name: "Dona",
    password: NEW_PASSWORD,
  });
  assert.ok(accepted.ok);
  assert.equal(accepted.userId, userId, "same account, same history");
  const [account] = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, userId));
  assert.equal(account?.banned, false);
  assert.equal(account?.role, "owner");
  assert.equal(account?.twoFactorEnabled, false, "the panel asks to set 2FA up again");
  assert.equal((await signIn(email, NEW_PASSWORD)).status, 200);
  assert.notEqual((await signIn(email, OLD_PASSWORD)).status, 200);
});

test("an e-mail that is not an admin is not a recovery; a plain invite to an admin is refused", async () => {
  assert.equal(await startOwnerRecovery(db, "ninguem@exemplo.com"), null);
  const email = "ja-admin@exemplo.com";
  await ownerWithTwoFactorAndSession(email);
  const { token } = await createAdminInvitation(db, { email, role: "owner", invitedBy: null });
  const again = await acceptAdminInvitation(db, auth, {
    token,
    name: "Outra",
    password: NEW_PASSWORD,
  });
  assert.deepEqual(again, { ok: false, reason: "already_admin" });
});
