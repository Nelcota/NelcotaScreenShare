import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import * as schema from "@/server/db/schema";
import {
  adminUsers,
  conversationMembers,
  conversations,
  messageAttachments,
  messages,
  proEntitlements,
  reports,
  users,
} from "@/server/db/schema";
import {
  attachToMessage,
  attachmentDownloadUrl,
  confirmAttachment,
  requestAttachmentUpload,
} from "@/features/messages/server/attachments.server";
import {
  attachmentsOfMessage,
  discardAttachments,
  releaseReportedFiles,
  sweepAttachments,
} from "@/features/messages/server/attachment-cleanup.server";
import { forgetMessages, messageData } from "@/features/messages/server/message-privacy.server";
import { insertMessage } from "@/features/messages/server/messages.server";
import { ATTACHMENT_LIMITS } from "@/features/messages/domain/attachments";
import { createReport } from "@/features/reports/server/create-report.server";
import { forgetReports } from "@/features/reports/server/personal-data.server";
import { createLocalDiskStorage } from "@/server/storage/local-disk-storage.server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
let root = "";
const storage = () =>
  createLocalDiskStorage({
    root,
    secret: "segredo-dos-anexos-de-teste-0123456789abcdef",
    baseUrl: "http://localhost:3000",
  });
const deps = () => ({ db, storage: storage() });

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "nelcota-attachments-"));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await pool.end();
});

async function person(name: string, options: { pro?: boolean; owner?: boolean } = {}) {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@exemplo.dev`;
  const [user] = await db
    .insert(users)
    .values({ name, email, emailVerified: true })
    .returning({ id: users.id });
  if (user === undefined) throw new Error("user not created");
  if (options.pro) await db.insert(proEntitlements).values({ userId: user.id, active: true });
  if (options.owner) await db.insert(adminUsers).values({ name, email, role: "owner" });
  return user.id;
}

async function conversation(...memberIds: string[]) {
  const [row] = await db
    .insert(conversations)
    .values({ kind: "group", name: "Grupo" })
    .returning({ id: conversations.id });
  if (row === undefined) throw new Error("conversation not created");
  await db
    .insert(conversationMembers)
    .values(memberIds.map((userId) => ({ conversationId: row.id, userId })));
  return row.id;
}

/** Asks to send a zip of this size: the plan's limit decides. */
function ask(userId: string, conversationId: string, size: number) {
  return requestAttachmentUpload(deps(), { userId, conversationId, fileName: "a.zip", size });
}

/** Sends the body through the signed link, as the browser would. */
async function upload(url: string, body: string | Uint8Array) {
  const token = new URL(url).pathname.split("/").at(-1) ?? "";
  expect(await storage().acceptUpload(token, Readable.from([Buffer.from(body)]))).toBe(true);
}

/** Sends a small text file in a message and returns its row's id and storage key. */
async function sentFile(author: string, conversationId: string) {
  const started = await requestAttachmentUpload(deps(), {
    userId: author,
    conversationId,
    fileName: "nota.txt",
    size: 2,
  });
  await upload(started.uploadUrl, "oi");
  await confirmAttachment(deps(), { userId: author, attachmentId: started.attachmentId });
  const message = await insertMessage(db, conversationId, author, { body: null, gifSlug: null });
  await attachToMessage(db, {
    attachmentId: started.attachmentId,
    authorId: author,
    conversationId,
    messageId: message.id,
  });
  const [row] = await db
    .select({ objectKey: messageAttachments.objectKey })
    .from(messageAttachments)
    .where(eq(messageAttachments.id, started.attachmentId));
  if (row === undefined) throw new Error("the attachment was not recorded");
  return { id: started.attachmentId, objectKey: row.objectKey, messageId: message.id };
}

describe("message attachments", () => {
  test("a member sends a file: the real size and type are recorded and the other member can fetch it", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const conversationId = await conversation(ana, bia);
    const started = await requestAttachmentUpload(deps(), {
      userId: ana,
      conversationId,
      fileName: "C:\\fotos\\nota.txt",
      size: 5,
    });
    await upload(started.uploadUrl, "olá!");

    const ready = await confirmAttachment(deps(), {
      userId: ana,
      attachmentId: started.attachmentId,
    });

    expect(ready).toMatchObject({
      kind: "text",
      size: Buffer.byteLength("olá!"),
      fileName: "nota.txt",
    });
    expect(
      await attachmentDownloadUrl(deps(), { userId: ana, attachmentId: ready.attachmentId }),
    ).toMatch(/\/api\/arquivos\/baixar\//);
  });

  test("someone outside the conversation gets not found, also before the file is sent", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const caio = await person("Caio");
    const conversationId = await conversation(ana, bia);
    await expect(
      requestAttachmentUpload(deps(), { userId: caio, conversationId, fileName: "a.txt", size: 1 }),
    ).rejects.toThrow("Arquivo não encontrado.");
    const started = await requestAttachmentUpload(deps(), {
      userId: ana,
      conversationId,
      fileName: "a.txt",
      size: 1,
    });
    await upload(started.uploadUrl, "a");
    await confirmAttachment(deps(), { userId: ana, attachmentId: started.attachmentId });

    for (const userId of [caio, bia]) {
      // Bia is in the conversation, but the file is not in a message yet: only Ana sees it.
      await expect(
        attachmentDownloadUrl(deps(), { userId, attachmentId: started.attachmentId }),
      ).rejects.toThrow("Arquivo não encontrado.");
    }
  });

  test("the limit is the sender's plan, with 1 GB only when everyone is a panel owner", async () => {
    const free = await person("Gratis");
    const pro = await person("Pro", { pro: true });
    const ownerOne = await person("Dona", { owner: true });
    const ownerTwo = await person("Dono", { owner: true });
    const mixed = await conversation(free, pro);
    const owners = await conversation(ownerOne, ownerTwo);

    await expect(ask(free, mixed, ATTACHMENT_LIMITS.free + 1)).rejects.toThrow("passa do limite");
    await expect(ask(pro, mixed, ATTACHMENT_LIMITS.free + 1)).resolves.toBeDefined();
    await expect(ask(pro, mixed, ATTACHMENT_LIMITS.pro + 1)).rejects.toThrow("passa do limite");
    await expect(ask(ownerOne, owners, ATTACHMENT_LIMITS.pro + 1)).resolves.toBeDefined();
    await expect(ask(ownerOne, owners, ATTACHMENT_LIMITS.owners + 1)).rejects.toThrow(
      "passa do limite",
    );
  });

  test("the size that really arrived decides: a bigger file is deleted with its row", async () => {
    const ana = await person("Ana");
    const conversationId = await conversation(ana, await person("Bia"));
    const started = await requestAttachmentUpload(deps(), {
      userId: ana,
      conversationId,
      fileName: "pequeno.txt",
      size: 1,
    });
    await upload(started.uploadUrl, "x".repeat(ATTACHMENT_LIMITS.free + 1));

    await expect(
      confirmAttachment(deps(), { userId: ana, attachmentId: started.attachmentId }),
    ).rejects.toThrow("passa do limite");

    expect(
      await db
        .select()
        .from(messageAttachments)
        .where(eq(messageAttachments.id, started.attachmentId)),
    ).toEqual([]);
  });

  test("a program is refused by name, and by content when renamed to .png", async () => {
    const ana = await person("Ana");
    const conversationId = await conversation(ana, await person("Bia"));
    await expect(
      requestAttachmentUpload(deps(), {
        userId: ana,
        conversationId,
        fileName: "setup.exe",
        size: 10,
      }),
    ).rejects.toThrow("não pode ser enviado");
    const started = await requestAttachmentUpload(deps(), {
      userId: ana,
      conversationId,
      fileName: "foto.png",
      size: 6,
    });
    await upload(started.uploadUrl, new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]));
    const [row] = await db
      .select({ objectKey: messageAttachments.objectKey })
      .from(messageAttachments)
      .where(eq(messageAttachments.id, started.attachmentId));

    await expect(
      confirmAttachment(deps(), { userId: ana, attachmentId: started.attachmentId }),
    ).rejects.toThrow("não pode ser enviado");

    if (row === undefined) throw new Error("the pending attachment was not recorded");
    expect(await storage().head(row.objectKey)).toBeNull();
  });

  test("a sent file reaches the other member; only the uploader's ready file goes in a message", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const conversationId = await conversation(ana, bia);
    const started = await requestAttachmentUpload(deps(), {
      userId: ana,
      conversationId,
      fileName: "nota.txt",
      size: 2,
    });
    await upload(started.uploadUrl, "oi");
    await confirmAttachment(deps(), { userId: ana, attachmentId: started.attachmentId });
    const message = await insertMessage(db, conversationId, ana, { body: null, gifSlug: null });
    const attach = (authorId: string) =>
      attachToMessage(db, {
        attachmentId: started.attachmentId,
        authorId,
        conversationId,
        messageId: message.id,
      });

    await expect(attach(bia)).rejects.toThrow("Arquivo não encontrado.");
    await attach(ana);
    await expect(attach(ana)).rejects.toThrow("Arquivo não encontrado.");

    expect(
      await attachmentDownloadUrl(deps(), { userId: bia, attachmentId: started.attachmentId }),
    ).toMatch(/\/api\/arquivos\/baixar\//);
  });

  test("deleting the message removes its file at once", async () => {
    const ana = await person("Ana");
    const conversationId = await conversation(ana, await person("Bia"));
    const file = await sentFile(ana, conversationId);

    const removed = await discardAttachments(
      deps(),
      await attachmentsOfMessage(db, file.messageId),
    );

    expect(removed).toBe(1);
    expect(await storage().head(file.objectKey)).toBeNull();
  });

  test("the sweep erases files whose conversation or sender is gone, and day-old uploads never sent", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const conversationId = await conversation(ana, bia);
    const groupGone = await sentFile(ana, conversationId);
    await db
      .update(messageAttachments)
      .set({ conversationId: null })
      .where(eq(messageAttachments.id, groupGone.id));
    const kept = await sentFile(bia, conversationId);
    const abandoned = await requestAttachmentUpload(deps(), {
      userId: bia,
      conversationId,
      fileName: "rascunho.txt",
      size: 1,
    });
    await upload(abandoned.uploadUrl, "x");
    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);

    await sweepAttachments(db, storage(), tomorrow);

    const left = await db
      .select({ id: messageAttachments.id })
      .from(messageAttachments)
      .where(inArray(messageAttachments.id, [groupGone.id, kept.id, abandoned.attachmentId]));
    expect(left).toEqual([{ id: kept.id }]);
    expect(await storage().head(groupGone.objectKey)).toBeNull();
    expect(await storage().head(kept.objectKey)).not.toBeNull();
  });

  test("a deleted account's files become unreachable and are swept; the export lists what was sent", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const conversationId = await conversation(ana, bia);
    const file = await sentFile(ana, conversationId);
    expect((await messageData(db, ana)).arquivos_enviados).toEqual([
      expect.objectContaining({ conversa: conversationId, nome: "nota.txt", tipo: "text" }),
    ]);

    await forgetMessages(db, ana);
    await expect(
      attachmentDownloadUrl(deps(), { userId: bia, attachmentId: file.id }),
    ).rejects.toThrow("Arquivo não encontrado.");
    await sweepAttachments(db, storage());

    expect(await storage().head(file.objectKey)).toBeNull();
  });
});

/** Bia reports Ana's message with a file. */
async function reportedFile() {
  const ana = await person("Ana");
  const bia = await person("Bia");
  const conversationId = await conversation(ana, bia);
  const file = await sentFile(ana, conversationId);
  await createReport(db, bia, {
    target: { kind: "message", messageId: file.messageId },
    reason: "spam",
    details: null,
  });
  return { ana, bia, conversationId, file };
}

function closeReportsOf(attachmentId: string) {
  return db
    .update(reports)
    .set({ status: "resolved", resolution: "no_action", resolvedAt: new Date() })
    .where(eq(reports.targetAttachmentId, attachmentId));
}

const tomorrow = () => new Date(Date.now() + 25 * 60 * 60 * 1000);

describe("reported files", () => {
  test("reporting a message with only a file names it in the copy and holds the file", async () => {
    const ana = await person("Ana");
    const bia = await person("Bia");
    const conversationId = await conversation(ana, bia);
    const file = await sentFile(ana, conversationId);

    await createReport(db, bia, {
      target: { kind: "message", messageId: file.messageId },
      reason: "spam",
      details: null,
    });

    const [report] = await db
      .select({
        messageExcerpt: reports.messageExcerpt,
        targetAttachmentId: reports.targetAttachmentId,
      })
      .from(reports)
      .where(eq(reports.targetMessageId, file.messageId));
    expect(report).toEqual({ messageExcerpt: "Arquivo: nota.txt", targetAttachmentId: file.id });
  });

  test("the author deleting a reported message keeps its file, also from the sweep, until the report is resolved", async () => {
    const { file } = await reportedFile();

    const removed = await discardAttachments(
      deps(),
      await attachmentsOfMessage(db, file.messageId),
    );
    await db.delete(messages).where(eq(messages.id, file.messageId));
    await sweepAttachments(db, storage(), tomorrow());
    expect(removed).toBe(0);
    expect(await storage().head(file.objectKey)).not.toBeNull();

    await closeReportsOf(file.id);
    expect(await releaseReportedFiles(deps(), [file.id])).toBe(1);
    expect(await storage().head(file.objectKey)).toBeNull();
  });

  test("resolving one report keeps a file another open report still holds", async () => {
    const { conversationId, file } = await reportedFile();
    const cai = await person("Cai");
    await db.insert(conversationMembers).values({ conversationId, userId: cai });
    await createReport(db, cai, {
      target: { kind: "message", messageId: file.messageId },
      reason: "hate",
      details: null,
    });
    await db.delete(messages).where(eq(messages.id, file.messageId));

    await db
      .update(reports)
      .set({ status: "resolved", resolution: "no_action", resolvedAt: new Date() })
      .where(and(eq(reports.targetAttachmentId, file.id), eq(reports.reporterId, cai)));
    const released = await releaseReportedFiles(deps(), [file.id]);

    expect(released).toBe(0);
    expect(await storage().head(file.objectKey)).not.toBeNull();
  });

  test("resolving a report leaves the file of a message that still exists", async () => {
    const { file } = await reportedFile();

    await closeReportsOf(file.id);

    expect(await releaseReportedFiles(deps(), [file.id])).toBe(0);
    expect(await storage().head(file.objectKey)).not.toBeNull();
  });

  test("the reporter deleting their account keeps the reported file until the report is resolved", async () => {
    const { bia, file } = await reportedFile();
    await db.delete(messages).where(eq(messages.id, file.messageId));

    await forgetReports(db, bia);
    await sweepAttachments(db, storage(), tomorrow());

    expect(await storage().head(file.objectKey)).not.toBeNull();
  });

  test("deleting the author's account erases a reported file, as it erases the copy of the text", async () => {
    const { ana, file } = await reportedFile();

    await forgetMessages(db, ana);
    await forgetReports(db, ana);
    await sweepAttachments(db, storage());

    expect(await storage().head(file.objectKey)).toBeNull();
  });
});
