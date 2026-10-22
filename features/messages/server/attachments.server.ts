import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  attachmentLimit,
  cleanFileName,
  detectAttachmentKind,
  hasBlockedExtension,
  SNIFF_BYTES,
  type AttachmentKind,
  type MessageAttachment,
} from "@/features/messages/domain/attachments";
import { membershipOf } from "@/features/messages/server/conversations.server";
import { entitlement } from "@/features/rooms/server/entitlements.server";
import type { DbExecutor } from "@/server/db/index.server";
import { adminUsers, conversationMembers, messageAttachments, users } from "@/server/db/schema";
import { ActionError } from "@/server/operations/action-error";
import { newObjectKey, type ObjectStorage } from "@/server/storage/object-storage.server";

/** The upload link only has to last for the upload to start. */
const UPLOAD_LINK_SECONDS = 15 * 60;
/** A download link is opened right after it is asked for. */
const DOWNLOAD_LINK_SECONDS = 5 * 60;

const NOT_FOUND = "Arquivo não encontrado.";
const TOO_LARGE = "Esse arquivo passa do limite do seu plano.";
const BLOCKED = "Esse tipo de arquivo não pode ser enviado.";
const BAD_NAME = "O nome do arquivo não é válido.";
const NOT_SENT = "O arquivo não chegou. Tente de novo.";

export interface AttachmentDeps {
  db: DbExecutor;
  storage: ObjectStorage;
}

/**
 * Whether everyone in the conversation is an active panel owner: their verified app e-mail
 * equals an owner's panel e-mail. Only then the 1 GB ceiling applies.
 */
async function everyoneIsOwner(db: DbExecutor, conversationId: string): Promise<boolean> {
  const [row] = await db
    .select({
      members: sql<number>`count(*)::int`,
      owners: sql<number>`count(${adminUsers.id})::int`,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .leftJoin(
      adminUsers,
      and(
        sql`lower(${adminUsers.email}) = lower(${users.email})`,
        eq(users.emailVerified, true),
        eq(adminUsers.role, "owner"),
        eq(adminUsers.banned, false),
      ),
    )
    .where(eq(conversationMembers.conversationId, conversationId));
  if (row === undefined) return false;
  return row.members > 0 && row.members === row.owners;
}

/** The sender's limit in this conversation, by their plan (ADR 0011). */
async function limitFor(db: DbExecutor, userId: string, conversationId: string): Promise<number> {
  const [pro, owners] = await Promise.all([
    entitlement(db, { userId }),
    everyoneIsOwner(db, conversationId),
  ]);
  return attachmentLimit({ senderPro: pro.active, everyoneIsOwner: owners });
}

async function requireMember(db: DbExecutor, conversationId: string, userId: string) {
  const membership = await membershipOf(db, conversationId, userId);
  if (membership === null) throw new ActionError(NOT_FOUND);
  return membership;
}

/**
 * Starts an upload: checks the name and the size the browser announces (a first, cheap
 * refusal), records a pending attachment and returns the signed link to send the file.
 */
export async function requestAttachmentUpload(
  { db, storage }: AttachmentDeps,
  input: { userId: string; conversationId: string; fileName: string; size: number },
): Promise<{ attachmentId: string; uploadUrl: string }> {
  await requireMember(db, input.conversationId, input.userId);
  const fileName = cleanFileName(input.fileName);
  if (fileName === null) throw new ActionError(BAD_NAME);
  if (hasBlockedExtension(fileName)) throw new ActionError(BLOCKED);
  if (input.size > (await limitFor(db, input.userId, input.conversationId))) {
    throw new ActionError(TOO_LARGE);
  }
  const objectKey = newObjectKey();
  const [row] = await db
    .insert(messageAttachments)
    .values({
      conversationId: input.conversationId,
      uploaderId: input.userId,
      objectKey,
      fileName,
    })
    .returning({ id: messageAttachments.id });
  if (row === undefined) throw new ActionError(NOT_SENT);
  const uploadUrl = await storage.uploadUrl(objectKey, {
    fileName,
    expiresInSeconds: UPLOAD_LINK_SECONDS,
  });
  return { attachmentId: row.id, uploadUrl };
}

async function pendingOf(db: DbExecutor, attachmentId: string, userId: string) {
  const [row] = await db
    .select()
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.id, attachmentId),
        eq(messageAttachments.uploaderId, userId),
        eq(messageAttachments.status, "pending"),
      ),
    );
  if (row === undefined) throw new ActionError(NOT_FOUND);
  return row;
}

/** Drops an upload that failed a check: the stored file and its row. */
async function discard({ db, storage }: AttachmentDeps, id: string, objectKey: string) {
  await storage.remove(objectKey);
  await db.delete(messageAttachments).where(eq(messageAttachments.id, id));
}

/**
 * After the browser sent the file: measures what really arrived and tells its type from the
 * first bytes. A file over the limit or of a refused kind is deleted with its row.
 */
export async function confirmAttachment(
  deps: AttachmentDeps,
  input: { userId: string; attachmentId: string },
): Promise<{ attachmentId: string; kind: AttachmentKind; size: number; fileName: string }> {
  const { db, storage } = deps;
  const row = await pendingOf(db, input.attachmentId, input.userId);
  if (row.conversationId === null) throw new ActionError(NOT_FOUND);
  const stored = await storage.head(row.objectKey);
  if (stored === null) throw new ActionError(NOT_SENT);
  if (stored.size > (await limitFor(db, input.userId, row.conversationId))) {
    await discard(deps, row.id, row.objectKey);
    throw new ActionError(TOO_LARGE);
  }
  const kind = detectAttachmentKind(await storage.readStart(row.objectKey, SNIFF_BYTES));
  if (kind === null) {
    await discard(deps, row.id, row.objectKey);
    throw new ActionError(BLOCKED);
  }
  await db
    .update(messageAttachments)
    .set({ status: "ready", kind, sizeBytes: stored.size, confirmedAt: new Date() })
    .where(eq(messageAttachments.id, row.id));
  return { attachmentId: row.id, kind, size: stored.size, fileName: row.fileName };
}

/**
 * A short download link, only for someone in the conversation. A file not yet sent in a
 * message is only for whoever uploaded it. Anyone else gets "not found".
 */
export async function attachmentDownloadUrl(
  { db, storage }: AttachmentDeps,
  input: { userId: string; attachmentId: string },
): Promise<string> {
  const [row] = await db
    .select()
    .from(messageAttachments)
    .where(
      and(eq(messageAttachments.id, input.attachmentId), eq(messageAttachments.status, "ready")),
    );
  if (row === undefined || row.conversationId === null) throw new ActionError(NOT_FOUND);
  const membership = await membershipOf(db, row.conversationId, input.userId);
  if (membership === null) throw new ActionError(NOT_FOUND);
  if (row.messageId === null && row.uploaderId !== input.userId) throw new ActionError(NOT_FOUND);
  return storage.downloadUrl(row.objectKey, DOWNLOAD_LINK_SECONDS);
}

/**
 * Puts a checked attachment in the message being sent, inside the same transaction: only the
 * uploader's own file, ready, in this conversation and not in another message yet.
 */
export async function attachToMessage(
  db: DbExecutor,
  input: { attachmentId: string; authorId: string; conversationId: string; messageId: string },
): Promise<void> {
  const attached = await db
    .update(messageAttachments)
    .set({ messageId: input.messageId })
    .where(
      and(
        eq(messageAttachments.id, input.attachmentId),
        eq(messageAttachments.uploaderId, input.authorId),
        eq(messageAttachments.conversationId, input.conversationId),
        eq(messageAttachments.status, "ready"),
        isNull(messageAttachments.messageId),
      ),
    )
    .returning({ id: messageAttachments.id });
  if (attached.length === 0) throw new ActionError(NOT_FOUND);
}

/** How long an image preview link in the conversation lasts. */
const PREVIEW_LINK_SECONDS = 30 * 60;

/**
 * The checked attachment of each message on the page, with a preview link for images. The
 * page was already limited to what the viewer may see, so every attachment here is theirs to
 * see. Without a storage (attachments off), files still show, without a preview.
 */
export async function withAttachments<Message extends { id: string }>(
  db: DbExecutor,
  storage: ObjectStorage | null,
  page: { messages: Message[]; hasMore: boolean },
): Promise<{ messages: (Message & { attachment: MessageAttachment | null })[]; hasMore: boolean }> {
  const ids = page.messages.map((message) => message.id);
  if (ids.length === 0) return { messages: [], hasMore: page.hasMore };
  const rows = await db
    .select()
    .from(messageAttachments)
    .where(and(inArray(messageAttachments.messageId, ids), eq(messageAttachments.status, "ready")));
  const byMessage = new Map<string, MessageAttachment>();
  await Promise.all(
    rows.map(async (row) => {
      if (row.messageId === null || row.kind === null || row.sizeBytes === null) return;
      const previewUrl =
        row.kind === "image" && storage !== null
          ? await storage.downloadUrl(row.objectKey, PREVIEW_LINK_SECONDS)
          : null;
      byMessage.set(row.messageId, {
        id: row.id,
        fileName: row.fileName,
        kind: row.kind,
        size: row.sizeBytes,
        previewUrl,
      });
    }),
  );
  const messages = page.messages.map((message) => ({
    ...message,
    attachment: byMessage.get(message.id) ?? null,
  }));
  return { messages, hasMore: page.hasMore };
}
