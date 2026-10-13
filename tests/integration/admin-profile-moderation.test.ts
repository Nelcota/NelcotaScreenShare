import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import type * as MailModule from "@/server/mail.server";

/** "Remover foto" and "Redefinir nome": audited, with the reason sent to the person. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/server/mail.server", async (original) => ({
  ...(await original<typeof MailModule>()),
  sendMail: async (message: { to: string; subject: string; text: string }) => {
    mail.sent.push(message);
  },
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const actions = await import("@/features/admin/participants/actions.server");
const { personalData } = await import("@/features/account/server/personal-data.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

type Session = Awaited<ReturnType<typeof adminSession>>;
let admin: Session;
let viewer: Session;
beforeAll(async () => {
  admin = await adminSession(db, "admin");
  viewer = await adminSession(db, "viewer");
});

async function person(image: string | null = "data:image/webp;base64,AAAA") {
  const email = `moderada-${crypto.randomUUID()}@exemplo.com`;
  const [user] = await db
    .insert(schema.users)
    .values({ name: "Nome Ofensivo", email, image })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return { id: user.id, email };
}

async function audited(id: string, action: string) {
  const [row] = await db
    .select({ metadata: schema.auditLogs.metadata })
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.resourceId, id), eq(schema.auditLogs.action, action)));
  return row?.metadata;
}

describe("remove photo", () => {
  test("clears the photo, audits the reason and e-mails it", async () => {
    const target = await person();
    requestHeaders.current = admin.headers;
    const result = await actions.removeParticipantPhotoAction({
      id: target.id,
      reason: "Foto com nudez",
    });
    assert.deepEqual(result.data, { mailed: true });
    const [user] = await db
      .select({ image: schema.users.image })
      .from(schema.users)
      .where(eq(schema.users.id, target.id));
    assert.equal(user?.image, null);
    assert.deepEqual(await audited(target.id, "user.photo_remove"), { motivo: "Foto com nudez" });
    const notice = mail.sent.find((message) => message.to === target.email);
    assert.equal(notice?.subject, "Sua foto no Nelcota foi removida");
    assert.match(notice?.text ?? "", /Motivo: Foto com nudez/);
  });

  test("an account without a photo, a short reason and a viewer are refused", async () => {
    const target = await person(null);
    requestHeaders.current = admin.headers;
    const none = await actions.removeParticipantPhotoAction({ id: target.id, reason: "Motivo" });
    assert.equal(none.serverError, "Essa conta não tem foto.");
    const short = await actions.removeParticipantPhotoAction({ id: target.id, reason: "x" });
    assert.ok(short.validationErrors);
    requestHeaders.current = viewer.headers;
    const denied = await actions.removeParticipantPhotoAction({ id: target.id, reason: "Motivo" });
    assert.equal(denied.serverError, "Você não tem permissão para fazer isso.");
  });
});

describe("reset name", () => {
  test("gives a neutral name, audits it without the old one and e-mails the reason", async () => {
    const target = await person();
    requestHeaders.current = admin.headers;
    const result = await actions.resetParticipantNameAction({
      id: target.id,
      reason: "Nome com ofensa",
    });
    assert.match(result.data?.name ?? "", /^Pessoa \d{4}$/);
    assert.equal(result.data?.mailed, true);
    const metadata = await audited(target.id, "user.name_reset");
    assert.deepEqual(metadata, { motivo: "Nome com ofensa", nome: result.data?.name });
    assert.doesNotMatch(JSON.stringify(metadata), /Ofensivo/);
    const notice = mail.sent.find((message) => message.to === target.email);
    assert.match(notice?.text ?? "", new RegExp(result.data?.name ?? "-"));
  });

  test("both changes show up in the person's data export", async () => {
    const target = await person();
    requestHeaders.current = admin.headers;
    await actions.removeParticipantPhotoAction({ id: target.id, reason: "Foto imprópria" });
    await actions.resetParticipantNameAction({ id: target.id, reason: "Nome impróprio" });
    const exported = await personalData(db, target.id);
    assert.deepEqual(
      exported.alteracoes_feitas_pela_equipe.map(({ alteracao, motivo }) => ({
        alteracao,
        motivo,
      })),
      [
        { alteracao: "Nome redefinido", motivo: "Nome impróprio" },
        { alteracao: "Foto removida", motivo: "Foto imprópria" },
      ],
    );
  });
});
