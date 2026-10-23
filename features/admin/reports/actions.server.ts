import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { blockParticipants } from "@/features/account/server/participant-accounts.server";
import type { ReportResolution } from "@/features/reports/domain/reports";
import { ActionError } from "@/server/operations/action-error";
import type { AuditRecorder } from "@/server/audit.server";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { messages, reports } from "@/server/db/schema";
import { refreshLastMessageAt } from "@/features/messages/server/messages.server";
import { releaseReportedFiles } from "@/features/messages/server/attachment-cleanup.server";
import { reportedFileDownloadUrl } from "@/features/messages/server/attachments.server";
import { logger } from "@/server/logger.server";
import { attachmentStorage } from "@/server/storage/attachment-storage.server";

const ALREADY_RESOLVED = "Essa denúncia já foi resolvida.";

async function openReport(tx: DbExecutor, id: string) {
  const [report] = await tx
    .select({
      id: reports.id,
      targetUserId: reports.targetUserId,
      targetMessageId: reports.targetMessageId,
      targetConversationId: reports.targetConversationId,
    })
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.status, "open")))
    .for("update");
  if (!report) throw new ActionError(ALREADY_RESOLVED);
  return report;
}

/**
 * Closes reports and drops the message copy: it was only kept for the review. Returns the
 * files those reports held, to release once the transaction is done.
 */
async function resolve(
  tx: DbExecutor,
  audit: AuditRecorder,
  where: ReturnType<typeof eq>,
  resolution: ReportResolution,
  adminId: string,
) {
  const closed = await tx
    .update(reports)
    .set({
      status: "resolved",
      resolution,
      resolvedAt: sql`now()`,
      resolvedByAdminId: adminId,
      messageExcerpt: null,
    })
    .where(and(where, eq(reports.status, "open")))
    .returning({ id: reports.id, attachmentId: reports.targetAttachmentId });
  await audit.recordMany(
    tx,
    closed.map((report) => ({
      action: "report.resolve",
      resourceType: "report",
      resourceId: report.id,
      metadata: { resultado: resolution },
    })),
  );
  return closed.map((report) => report.attachmentId);
}

/**
 * Deletes the files the resolved reports no longer hold. A failure only waits for the
 * maintenance sweep, so it never undoes the resolution.
 */
async function releaseFiles(attachmentIds: readonly (string | null)[]) {
  const storage = attachmentStorage();
  if (storage === null) return;
  try {
    await releaseReportedFiles({ db: getDb(), storage }, attachmentIds);
  } catch (error) {
    logger.warn({ err: error }, "reported files not released");
  }
}

const idInput = z.object({ id: z.uuid() });

export const resolveReportAction = defineAdminOperation(
  { name: "report.resolve", permission: { report: ["resolve"] }, audit: "required" },
  idInput,
  async ({ parsedInput, ctx }) => {
    const held = await getDb().transaction(async (tx) => {
      const report = await openReport(tx, parsedInput.id);
      return resolve(tx, ctx.audit, eq(reports.id, report.id), "no_action", ctx.admin.user.id);
    });
    await releaseFiles(held);
    return { resolved: true };
  },
);

/** Deletes the reported message and closes every open report of it. */
export const deleteReportedMessageAction = defineAdminOperation(
  { name: "report.deleteMessage", permission: { report: ["resolve"] }, audit: "required" },
  idInput,
  async ({ parsedInput, ctx }) => {
    const held = await getDb().transaction(async (tx) => {
      const report = await openReport(tx, parsedInput.id);
      if (!report.targetMessageId) throw new ActionError("A mensagem já foi apagada.");
      const messageId = report.targetMessageId;
      const files = await resolve(
        tx,
        ctx.audit,
        eq(reports.targetMessageId, messageId),
        "message_deleted",
        ctx.admin.user.id,
      );
      await tx.delete(messages).where(eq(messages.id, messageId));
      if (report.targetConversationId) await refreshLastMessageAt(tx, report.targetConversationId);
      await ctx.audit.record(tx, {
        action: "message.delete",
        resourceType: "message",
        resourceId: messageId,
        metadata: { denuncia: report.id },
      });
      return files;
    });
    await releaseFiles(held);
    return { deleted: true };
  },
);

/** Blocks the reported account (as in Participantes) and closes this report. */
export const blockReportedAccountAction = defineAdminOperation(
  {
    name: "report.blockAccount",
    permission: { report: ["resolve"], participant: ["update"] },
    audit: "required",
  },
  z.object({
    id: z.uuid(),
    reason: z
      .string()
      .trim()
      .min(3, "Escreva o motivo do bloqueio.")
      .max(300, "O motivo pode ter até 300 caracteres."),
  }),
  async ({ parsedInput, ctx }) => {
    const held = await getDb().transaction(async (tx) => {
      const report = await openReport(tx, parsedInput.id);
      if (!report.targetUserId)
        throw new ActionError("Essa denúncia não tem uma conta para bloquear.");
      const blocked = await blockParticipants(tx, [report.targetUserId], parsedInput.reason);
      await ctx.audit.recordMany(
        tx,
        blocked.map((userId) => ({
          action: "user.block",
          resourceType: "user",
          resourceId: userId,
          metadata: { motivo: parsedInput.reason, denuncia: report.id },
        })),
      );
      return resolve(
        tx,
        ctx.audit,
        eq(reports.id, report.id),
        "account_blocked",
        ctx.admin.user.id,
      );
    });
    await releaseFiles(held);
    return { blocked: true };
  },
);

/** A short link to the reported file, to review it; every download goes to the audit log. */
export const downloadReportedFileAction = defineAdminOperation(
  { name: "report.downloadFile", permission: { report: ["read"] }, audit: "required" },
  idInput,
  async ({ parsedInput, ctx }) => {
    const storage = attachmentStorage();
    if (storage === null) throw new ActionError("Os anexos estão desligados.");
    const db = getDb();
    const url = await reportedFileDownloadUrl({ db, storage }, parsedInput.id);
    await ctx.audit.record(db, {
      action: "report.download_file",
      resourceType: "report",
      resourceId: parsedInput.id,
    });
    return { url };
  },
);
