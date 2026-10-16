import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { RouterContextProvider, type LoaderFunctionArgs } from "react-router";
import { afterAll, beforeAll, describe, test } from "vitest";
import * as schema from "@/server/db/schema";

/**
 * Forms posted without JS (before hydration, or after a script failed to load) reach the
 * route action, which answers with the form error or the redirect, never the error page.
 */
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { getAdminAuth } = await import("@/features/auth/server/admin-auth.server");
const { acceptAdminInvitation, createAdminInvitation } =
  await import("@/features/auth/server/admin-invitations.server");
const adminSignIn = await import("@/app/routes/admin/access/sign-in");
const adminForgot = await import("@/app/routes/admin/access/forgot-password");
const adminReset = await import("@/app/routes/admin/access/reset-password");
const adminTwoFactor = await import("@/app/routes/admin/access/two-factor");
const adminInvitation = await import("@/app/routes/admin/access/invitation");
const signIn = await import("@/app/routes/access/sign-in");
const signUp = await import("@/app/routes/access/sign-up");
const { handleParticipantAuth } =
  await import("@/features/auth/server/participant-auth-route.server");
const { verifiedParticipant } = await import("./support/accounts");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const PASSWORD = "senha-forte-do-admin-123";
const origin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
let counter = 0;

type RouteAction = (args: LoaderFunctionArgs) => Promise<unknown>;

/** A browser form post: urlencoded body, same-origin headers and its own client IP. */
function formPost(path: string, fields: Record<string, string>, from = origin) {
  counter += 1;
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: from,
      "x-client-ip": `198.51.100.${counter}`,
    },
    body: new URLSearchParams(fields).toString(),
  });
}

/** Runs the action; a thrown redirect comes back as the Response. */
async function submit(action: RouteAction, request: Request, params: Record<string, string> = {}) {
  try {
    const context = new RouterContextProvider();
    return await action({ request, params, context, url: new URL(request.url), pattern: "" });
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

function formError(result: unknown) {
  const { data, init } = result as { data: { error: string }; init: { status: number } };
  return { error: data.error, status: init.status };
}

let email: string;
beforeAll(async () => {
  const auth = getAdminAuth();
  assert.ok(auth);
  email = `nativo-${Date.now()}@exemplo.com`;
  const { token } = await createAdminInvitation(db, { email, role: "viewer", invitedBy: null });
  const accepted = await acceptAdminInvitation(db, auth, {
    token,
    name: "Nativo",
    password: PASSWORD,
  });
  assert.ok(accepted.ok);
});

describe("admin sign-in without JS", () => {
  test("a wrong password comes back to the page with the message", async () => {
    const result = await submit(
      adminSignIn.action,
      formPost("/admin/entrar", { email, password: "senha-errada-123" }),
    );
    assert.deepEqual(formError(result), { error: "E-mail ou senha incorretos.", status: 400 });
  });

  test("the right password signs in and goes to the panel with the session cookie", async () => {
    const result = await submit(
      adminSignIn.action,
      formPost("/admin/entrar", { email, password: PASSWORD }),
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("location"), "/admin");
    assert.ok(result.headers.getSetCookie().length > 0);
  });

  test("a post from another site is refused with a message, not the error page", async () => {
    const result = await submit(
      adminSignIn.action,
      formPost("/admin/entrar", { email, password: PASSWORD }, "https://outro.exemplo"),
    );
    assert.equal(formError(result).status, 400);
  });
});

describe("participant forms without JS", () => {
  test("sign-in: wrong password stays with the message, the right one goes where it was heading", async () => {
    const person = await verifiedParticipant(db, handleParticipantAuth);
    const wrong = await submit(
      signIn.action,
      formPost("/entrar?voltar=%2Fconta", { email: person.email, password: "errada-123456" }),
    );
    assert.deepEqual(formError(wrong), { error: "E-mail ou senha incorretos.", status: 400 });
    const right = await submit(
      signIn.action,
      formPost("/entrar?voltar=%2Fconta", { email: person.email, password: person.password }),
    );
    assert.ok(right instanceof Response);
    assert.equal(right.headers.get("location"), "/conta");
    assert.ok(right.headers.getSetCookie().length > 0);
  });

  test("sign-up: checked like the page, then on to confirm the e-mail", async () => {
    const invalid = await submit(
      signUp.action,
      formPost("/cadastro", { name: "Bia", email: "sem-arroba", password: "senha-boa-123" }),
    );
    assert.deepEqual(formError(invalid), { error: "Digite um e-mail válido.", status: 400 });
    const newEmail = `nova-${Date.now()}@exemplo.com`;
    const created = await submit(
      signUp.action,
      formPost("/cadastro", { name: "Bia", email: newEmail, password: "senha-boa-123" }),
    );
    assert.ok(created instanceof Response);
    assert.match(created.headers.get("location") ?? "", /^\/verificar-email\?email=/);
  });
});

describe("admin forms without JS", () => {
  test("forgot password answers the same for any e-mail", async () => {
    const result = await submit(adminForgot.action, formPost("/admin/recuperar-senha", { email }));
    assert.deepEqual(result, { sent: true });
  });

  test("reset password: different passwords and a dead link come back with the message", async () => {
    const mismatch = await submit(
      adminReset.action,
      formPost("/admin/redefinir-senha?token=abc", {
        password: "senha-nova-do-admin-1",
        confirm: "outra-senha-do-admin",
      }),
    );
    assert.deepEqual(formError(mismatch), { error: "As senhas não são iguais.", status: 400 });
    const dead = await submit(
      adminReset.action,
      formPost("/admin/redefinir-senha?token=abc", {
        password: "senha-nova-do-admin-1",
        confirm: "senha-nova-do-admin-1",
      }),
    );
    assert.deepEqual(formError(dead), {
      error: "Este link não vale mais. Peça um novo.",
      status: 400,
    });
  });

  test("2FA without the sign-in step comes back with the message", async () => {
    const result = await submit(
      adminTwoFactor.action,
      formPost("/admin/verificar-2fa", { code: "123456", mode: "totp" }),
    );
    assert.equal(formError(result).status, 400);
  });

  test("invitation: checked like the page, then on to sign in", async () => {
    const invited = `convidado-${Date.now()}@exemplo.com`;
    const { token } = await createAdminInvitation(db, {
      email: invited,
      role: "viewer",
      invitedBy: null,
    });
    const mismatch = await submit(
      adminInvitation.action,
      formPost(`/admin/convite/${token}`, { name: "Novo", password: PASSWORD, confirm: "outra" }),
      { token },
    );
    assert.deepEqual(formError(mismatch), { error: "As senhas não são iguais.", status: 400 });
    const accepted = await submit(
      adminInvitation.action,
      formPost(`/admin/convite/${token}`, { name: "Novo", password: PASSWORD, confirm: PASSWORD }),
      { token },
    );
    assert.ok(accepted instanceof Response);
    assert.equal(accepted.headers.get("location"), "/admin/entrar?aviso=convite");
  });
});
