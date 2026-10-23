import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { newObjectKey } from "@/server/storage/object-storage.server";
import { verifiedParticipant } from "./support/accounts";

const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { reportAction } = await import("@/features/reports/actions.server");
const {
  blockReportedAccountAction,
  deleteReportedMessageAction,
  downloadReportedFileAction,
  resolveReportAction,
} = await import("@/features/admin/reports/actions.server");
const { getReport, listReports } = await import("@/features/admin/reports/server/queries.server");
const { personalData } = await import("@/features/account/server/personal-data.server");
const { anonymizeParticipant } =
  await import("@/features/account/server/participant-accounts.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Participant = Awaited<ReturnType<typeof verifiedParticipant>>;
let reporter: Participant;
let author: Participant;
let outsider: Participant;
let owner: Awaited<ReturnType<typeof adminSession>>;

function as(person: Participant) {
  requestHeaders.current = new Headers({ cookie: person.jar.header() });
}

/** A direct conversation between reporter and author with `count` messages from the author. */
async function conversationWithMessages(count: number) {
  const [low, high] = [reporter.id, author.id].toSorted();
  await db
    .delete(schema.conversations)
    .where(
      and(eq(schema.conversations.kind, "direct"), eq(schema.conversations.directLowId, low!)),
    );
  const [conversation] = await db
    .insert(schema.conversations)
    .values({ kind: "direct", directLowId: low, directHighId: high })
    .returning();
  assert.ok(conversation);
  await db.insert(schema.conversationMembers).values([
    { conversationId: conversation.id, userId: reporter.id },
    { conversationId: conversation.id, userId: author.id },
  ]);
  const ids: string[] = [];
  // One at a time: UUID v7 ids then follow the order the messages were sent.
  for (const index of Array.from({ length: count }, (_, position) => position + 1)) {
    const inserted: { id: string }[] = await db
      .insert(schema.messages)
      .values({ conversationId: conversation.id, authorId: author.id, body: `mensagem ${index}` })
      .returning({ id: schema.messages.id });
    const id = inserted[0]?.id;
    assert.ok(id);
    ids.push(id);
  }
  return { conversationId: conversation.id, messageIds: ids };
}

beforeAll(async () => {
  reporter = await verifiedParticipant(db, handler, { name: "Quem Denuncia" });
  author = await verifiedParticipant(db, handler, { name: "Autor" });
  outsider = await verifiedParticipant(db, handler, { name: "De Fora" });
  owner = await adminSession(db, "owner");
});

describe("reporting", () => {
  test("a message report records the author, the conversation and a copy of that message", async () => {
    const { conversationId, messageIds } = await conversationWithMessages(7);
    const reported = messageIds.at(-1)!;
    as(reporter);

    const result = await reportAction({
      target: { kind: "message", messageId: reported },
      reason: "harassment",
      details: "Ofensa direta",
    });
    assert.deepEqual(result.data, { reported: true });
    // Repeating it while open adds nothing to the queue.
    await reportAction({ target: { kind: "message", messageId: reported }, reason: "spam" });

    const rows = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.targetMessageId, reported));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.targetUserId, author.id);
    assert.equal(rows[0]?.targetConversationId, conversationId);
    assert.equal(rows[0]?.messageExcerpt, "mensagem 7");

    const detail = await getReport(db, rows[0]?.id ?? "");
    assert.deepEqual(
      detail?.context.map((message) => message.body),
      ["mensagem 2", "mensagem 3", "mensagem 4", "mensagem 5", "mensagem 6", "mensagem 7"],
    );
  });

  test("only members can report a message, and not their own", async () => {
    const { messageIds } = await conversationWithMessages(1);
    as(outsider);
    const stranger = await reportAction({
      target: { kind: "message", messageId: messageIds[0]! },
      reason: "spam",
    });
    assert.equal(stranger.serverError, "Não encontramos o que você quer denunciar.");

    as(author);
    const own = await reportAction({
      target: { kind: "message", messageId: messageIds[0]! },
      reason: "spam",
    });
    assert.equal(own.serverError, "Você não pode denunciar a própria mensagem.");
  });

  test("one person can send at most 10 reports per hour", async () => {
    await db.insert(schema.reports).values(
      Array.from({ length: 10 }, () => ({
        reporterId: outsider.id,
        targetKind: "user" as const,
        targetUserId: null,
        reason: "spam" as const,
        status: "resolved" as const,
        resolution: "no_action" as const,
        resolvedAt: new Date(),
      })),
    );
    as(outsider);
    const result = await reportAction({
      target: { kind: "user", userId: author.id },
      reason: "spam",
    });
    assert.equal(result.serverError, "Você já enviou muitas denúncias. Tente de novo mais tarde.");
  });
});

describe("moderation", () => {
  test("deleting the reported message closes its reports and is audited", async () => {
    const { messageIds } = await conversationWithMessages(2);
    const reported = messageIds[1]!;
    as(reporter);
    await reportAction({ target: { kind: "message", messageId: reported }, reason: "hate" });
    const [report] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.targetMessageId, reported));
    assert.ok(report);

    requestHeaders.current = owner.headers;
    const result = await deleteReportedMessageAction({ id: report.id });
    assert.deepEqual(result.data, { deleted: true });

    const gone = await db.select().from(schema.messages).where(eq(schema.messages.id, reported));
    assert.equal(gone.length, 0);
    const [closed] = await db.select().from(schema.reports).where(eq(schema.reports.id, report.id));
    assert.equal(closed?.status, "resolved");
    assert.equal(closed?.resolution, "message_deleted");
    assert.equal(closed?.messageExcerpt, null);
    const audits = await db
      .select({ action: schema.auditLogs.action })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorAdminId, owner.id));
    assert.ok(audits.some((entry) => entry.action === "message.delete"));
    assert.ok(audits.some((entry) => entry.action === "report.resolve"));

    const again = await resolveReportAction({ id: report.id });
    assert.equal(again.serverError, "Essa denúncia já foi resolvida.");
  });

  test("the panel still opens a reported file after its author deleted the message", async () => {
    const { conversationId, messageIds } = await conversationWithMessages(1);
    const reported = messageIds[0]!;
    const [file] = await db
      .insert(schema.messageAttachments)
      .values({
        conversationId,
        messageId: reported,
        uploaderId: author.id,
        objectKey: newObjectKey(),
        fileName: "prova.pdf",
        status: "ready",
        kind: "pdf",
        sizeBytes: 10,
      })
      .returning({ id: schema.messageAttachments.id });
    assert.ok(file);
    as(reporter);
    await reportAction({ target: { kind: "message", messageId: reported }, reason: "sexual" });
    const [report] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.targetMessageId, reported));
    assert.ok(report);
    await db.delete(schema.messages).where(eq(schema.messages.id, reported));

    const detail = await getReport(db, report.id);
    assert.deepEqual(detail?.report.file, { fileName: "prova.pdf", kind: "pdf", size: 10 });
    requestHeaders.current = owner.headers;
    const opened = await downloadReportedFileAction({ id: report.id });
    assert.match(opened.data?.url ?? "", /\/api\/arquivos\/baixar\//);
    const audits = await db
      .select({ resourceId: schema.auditLogs.resourceId })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "report.download_file"));
    assert.ok(audits.some((entry) => entry.resourceId === report.id));
  });

  test("a resolved report no longer shows nor downloads the file of a message that stays", async () => {
    const { conversationId, messageIds } = await conversationWithMessages(1);
    const reported = messageIds[0]!;
    await db.insert(schema.messageAttachments).values({
      conversationId,
      messageId: reported,
      uploaderId: author.id,
      objectKey: newObjectKey(),
      fileName: "prova.pdf",
      status: "ready",
      kind: "pdf",
      sizeBytes: 10,
    });
    as(reporter);
    await reportAction({ target: { kind: "message", messageId: reported }, reason: "sexual" });
    const [report] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.targetMessageId, reported));
    assert.ok(report);
    requestHeaders.current = owner.headers;
    await resolveReportAction({ id: report.id });

    const detail = await getReport(db, report.id);
    assert.equal(detail?.report.file, null);
    const opened = await downloadReportedFileAction({ id: report.id });
    assert.equal(opened.data, undefined);
    assert.equal(opened.serverError, "Arquivo não encontrado.");
  });

  test("deleting a reported message from the panel also deletes the file the report held", async () => {
    const { conversationId, messageIds } = await conversationWithMessages(1);
    const reported = messageIds[0]!;
    const [file] = await db
      .insert(schema.messageAttachments)
      .values({
        conversationId,
        messageId: reported,
        uploaderId: author.id,
        objectKey: newObjectKey(),
        fileName: "prova.pdf",
        status: "ready",
        kind: "pdf",
        sizeBytes: 10,
      })
      .returning({ id: schema.messageAttachments.id });
    assert.ok(file);
    as(reporter);
    await reportAction({ target: { kind: "message", messageId: reported }, reason: "sexual" });
    const [report] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.targetMessageId, reported));
    assert.equal(report?.targetAttachmentId, file.id);

    requestHeaders.current = owner.headers;
    assert.deepEqual((await deleteReportedMessageAction({ id: report.id })).data, {
      deleted: true,
    });

    const left = await db
      .select()
      .from(schema.messageAttachments)
      .where(eq(schema.messageAttachments.id, file.id));
    assert.equal(left.length, 0);
  });

  test("blocking from a person report blocks the account and closes the report", async () => {
    as(reporter);
    await reportAction({ target: { kind: "user", userId: author.id }, reason: "harassment" });
    const { rows } = await listReports(db, "open");
    const report = rows.find((row) => row.targetKind === "user");
    assert.ok(report);

    requestHeaders.current = owner.headers;
    const result = await blockReportedAccountAction({ id: report.id, reason: "Assédio repetido" });
    assert.deepEqual(result.data, { blocked: true });
    const [blocked] = await db.select().from(schema.users).where(eq(schema.users.id, author.id));
    assert.ok(blocked?.blockedAt);
    const [closed] = await db.select().from(schema.reports).where(eq(schema.reports.id, report.id));
    assert.equal(closed?.resolution, "account_blocked");
  });
});

describe("personal data", () => {
  test("reports go into the reporter's export and lose their text on anonymization", async () => {
    const exported = await personalData(db, reporter.id);
    assert.ok(exported.denuncias_feitas.length >= 1);
    assert.ok(exported.denuncias_feitas.every((entry) => !("targetUserId" in entry)));

    await db.transaction((tx) => anonymizeParticipant(tx, reporter.id));
    const left = await db
      .select({ details: schema.reports.details, excerpt: schema.reports.messageExcerpt })
      .from(schema.reports)
      .where(eq(schema.reports.reporterId, reporter.id));
    assert.ok(left.every((row) => row.details === null && row.excerpt === null));
  });
});
