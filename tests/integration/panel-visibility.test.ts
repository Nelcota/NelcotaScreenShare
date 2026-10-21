import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import * as schema from "@/server/db/schema";

// The panel exists only with its own secret; set before the environment is first read.
const SECRET = "segredo-do-painel-de-teste-0123456789abcdef";
const previousSecret = process.env.ADMIN_AUTH_SECRET;
beforeAll(() => {
  process.env.ADMIN_AUTH_SECRET = SECRET;
});
afterAll(() => {
  if (previousSecret === undefined) delete process.env.ADMIN_AUTH_SECRET;
  if (previousSecret !== undefined) process.env.ADMIN_AUTH_SECRET = previousSecret;
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

async function verdict(path: string, cookie?: string) {
  const { panelVerdict } = await import("@/features/auth/server/panel-visibility.server");
  const headers = new Headers(cookie ? { cookie } : {});
  return panelVerdict(new Request(`http://localhost:3000${path}`, { headers }));
}

async function invitation(expiresInMs: number) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.adminInvitations).values({
    email: `convite-${crypto.randomUUID()}@exemplo.com`,
    role: "viewer",
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + expiresInMs),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });
  return token;
}

describe("the hidden admin panel", () => {
  beforeEach(async () => {
    await db.delete(schema.adminInvitations);
    await db.delete(schema.adminVerifications);
  });

  test("the rest of the site is never touched", async () => {
    assert.deepEqual(await verdict("/inicio"), { kind: "through" });
  });

  test("without a session, pass or team account, every panel address is hidden", async () => {
    for (const path of [
      "/admin",
      "/admin/entrar",
      "/admin/usuarios.data",
      "/api/admin/auth/sign-in/email",
    ]) {
      assert.deepEqual(await verdict(path), { kind: "hidden" }, path);
    }
  });

  /** React Router matches these to the panel's routes: they must be hidden too. */
  test("case, encoded letters and broken encoding do not get around the check", async () => {
    for (const path of [
      "/ADMIN",
      "/Admin/entrar.data",
      "/%61dmin/entrar",
      "/API/ADMIN/auth/sign-in/email",
      "/admin%E0%A4%A",
    ]) {
      assert.deepEqual(await verdict(path), { kind: "hidden" }, path);
    }
  });

  test("a valid invitation opens and grants the pass; a wrong or expired one is hidden", async () => {
    const valid = await invitation(60 * 60 * 1000);
    const granted = await verdict(`/admin/convite/${valid}`);
    assert.equal(granted.kind, "grant");
    assert.match(granted.kind === "grant" ? granted.cookie : "", /^nelcota-admin-pass=.+HttpOnly/);
    assert.deepEqual(await verdict("/admin/convite/nao-existe"), { kind: "hidden" });
    const expired = await invitation(-60 * 1000);
    assert.deepEqual(await verdict(`/admin/convite/${expired}`), { kind: "hidden" });
  });

  test("a new-password link opens only while its token is valid", async () => {
    await db.insert(schema.adminVerifications).values({
      identifier: "reset-password:token-bom",
      value: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    assert.equal((await verdict("/admin/redefinir-senha?token=token-bom")).kind, "grant");
    assert.deepEqual(await verdict("/admin/redefinir-senha?token=token-ruim"), { kind: "hidden" });
  });

  /** The e-mail opens the panel API first; hiding it locked a team member out. */
  test("the e-mailed new-password link opens only while its token is valid", async () => {
    await db.insert(schema.adminVerifications).values({
      identifier: "reset-password:token-do-email",
      value: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const callback = "?callbackURL=%2Fadmin%2Fredefinir-senha";
    const granted = await verdict(`/api/admin/auth/reset-password/token-do-email${callback}`);
    assert.equal(granted.kind, "grant");
    assert.deepEqual(await verdict(`/api/admin/auth/reset-password/token-ruim${callback}`), {
      kind: "hidden",
    });
  });

  /** The check runs before React Router: a renewal it causes must still reach the browser. */
  test("a panel session renewed by the check sends its new cookie", async () => {
    const { adminSession } = await import("./support/admin-session");
    const { collectSessionCookies } = await import("@/server/response-cookies.server");
    const { panelVerdict } = await import("@/features/auth/server/panel-visibility.server");
    const admin = await adminSession(db, "viewer");
    await db
      .update(schema.adminSessions)
      .set({ expiresAt: new Date(Date.now() + 10 * 60 * 60_000) })
      .where(eq(schema.adminSessions.userId, admin.id));
    const request = new Request("http://localhost:3000/admin", { headers: admin.headers });
    const { result, cookies } = await collectSessionCookies(() => panelVerdict(request));
    assert.deepEqual(result, { kind: "through" });
    assert.ok(
      cookies.some(
        (value) => value.startsWith("nelcota-admin.session_token=") && /Max-Age=43200/i.test(value),
      ),
    );
  });

  test("the pass opens the panel's sign-in and its API", async () => {
    const { signAdminPass } = await import("@/features/auth/server/admin-pass.server");
    const cookie = `nelcota-admin-pass=${signAdminPass(SECRET)}`;
    assert.deepEqual(await verdict("/admin/entrar", cookie), { kind: "through" });
    assert.deepEqual(await verdict("/api/admin/auth/sign-in/email", cookie), { kind: "through" });
    const forged = `nelcota-admin-pass=${signAdminPass("outro-segredo-0123456789abcdef0123456789")}`;
    assert.deepEqual(await verdict("/admin/entrar", forged), { kind: "hidden" });
  });
});
