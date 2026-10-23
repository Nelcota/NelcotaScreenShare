import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { AttachmentDeps } from "@/features/messages/server/attachments.server";
import type { DbExecutor } from "@/server/db/index.server";
import { messageAttachments, reports } from "@/server/db/schema";
import { logger } from "@/server/logger.server";
import type { ObjectStorage } from "@/server/storage/object-storage.server";

/** An upload never sent in a message is kept this long, then swept. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;
/** Rows handled per sweep; the next run takes the rest. */
const SWEEP_BATCH = 500;

type StoredRow = { id: string; objectKey: string };

/** No open report holds the file: a report keeps it for the review until it is resolved. */
const notHeldByOpenReport = sql`not exists (
  select 1 from ${reports}
  where ${reports.targetAttachmentId} = ${messageAttachments.id} and ${reports.status} = 'open'
)`;

/**
 * The files of one message, read before it is deleted. A file an open report holds is left
 * out: it stays for the review and goes when the report is resolved.
 */
export async function attachmentsOfMessage(
  db: DbExecutor,
  messageId: string,
): Promise<StoredRow[]> {
  return db
    .select({ id: messageAttachments.id, objectKey: messageAttachments.objectKey })
    .from(messageAttachments)
    .where(and(eq(messageAttachments.messageId, messageId), notHeldByOpenReport));
}

/**
 * Deletes the stored files and then their rows. A file that fails to go keeps its row, so the
 * next sweep tries again; one failure never stops the others.
 */
export async function discardAttachments(
  { db, storage }: AttachmentDeps,
  rows: readonly StoredRow[],
): Promise<number> {
  const removed = await Promise.allSettled(rows.map((row) => storage.remove(row.objectKey)));
  const gone = rows.filter((_, index) => removed[index]?.status === "fulfilled");
  for (const [index, outcome] of removed.entries()) {
    if (outcome.status === "rejected") {
      logger.warn({ err: outcome.reason, attachmentId: rows[index]?.id }, "attachment not removed");
    }
  }
  if (gone.length === 0) return 0;
  await db.delete(messageAttachments).where(
    inArray(
      messageAttachments.id,
      gone.map((row) => row.id),
    ),
  );
  return gone.length;
}

/**
 * The files nobody can reach any more (LGPD): their conversation or their sender's account is
 * gone, or the upload was never sent in a message for a day (a deleted message leaves its
 * file this way too, when removing it at once failed). A file an open report holds waits for
 * the report. Runs with the maintenance.
 */
export async function sweepAttachments(
  db: DbExecutor,
  storage: ObjectStorage | null,
  now = new Date(),
): Promise<number> {
  if (storage === null) return 0;
  const abandonedBefore = new Date(now.getTime() - ABANDONED_AFTER_MS);
  const rows = await db
    .select({ id: messageAttachments.id, objectKey: messageAttachments.objectKey })
    .from(messageAttachments)
    .where(
      and(
        or(
          isNull(messageAttachments.conversationId),
          isNull(messageAttachments.uploaderId),
          and(
            isNull(messageAttachments.messageId),
            lt(messageAttachments.createdAt, abandonedBefore),
          ),
        ),
        notHeldByOpenReport,
      ),
    )
    .limit(SWEEP_BATCH);
  return discardAttachments({ db, storage }, rows);
}

/**
 * After reports are resolved: deletes their files that nothing keeps any more, because the
 * message is gone and no other open report holds them. A file whose message still exists
 * stays with it.
 */
export async function releaseReportedFiles(
  deps: AttachmentDeps,
  attachmentIds: readonly (string | null)[],
): Promise<number> {
  const ids = attachmentIds.filter((id) => id !== null);
  if (ids.length === 0) return 0;
  const rows = await deps.db
    .select({ id: messageAttachments.id, objectKey: messageAttachments.objectKey })
    .from(messageAttachments)
    .where(
      and(
        inArray(messageAttachments.id, ids),
        isNull(messageAttachments.messageId),
        notHeldByOpenReport,
      ),
    );
  return discardAttachments(deps, rows);
}
