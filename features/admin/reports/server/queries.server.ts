import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbExecutor } from "@/server/db/index.server";
import { conversations, messages, reports, users } from "@/server/db/schema";
import type { ReportStatus } from "@/features/reports/domain/reports";

const QUEUE_SHOWN = 100;
/** How many earlier messages of the same conversation the moderator sees. */
const CONTEXT_BEFORE = 5;

const reporter = alias(users, "reporter");
const target = alias(users, "target");

/** The queue: open reports oldest first (first in, first handled); resolved newest first. */
export async function listReports(db: DbExecutor, status: ReportStatus) {
  const [rows, open] = await Promise.all([
    db
      .select({
        id: reports.id,
        targetKind: reports.targetKind,
        reason: reports.reason,
        targetName: target.name,
        resolution: reports.resolution,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .leftJoin(target, eq(target.id, reports.targetUserId))
      .where(eq(reports.status, status))
      .orderBy(status === "open" ? asc(reports.createdAt) : desc(reports.createdAt))
      .limit(QUEUE_SHOWN),
    db.select({ value: count() }).from(reports).where(eq(reports.status, "open")),
  ]);
  return { rows, open: open[0]?.value ?? 0 };
}

export type ReportQueueRow = Awaited<ReturnType<typeof listReports>>["rows"][number];

const messageColumns = {
  id: messages.id,
  authorName: users.name,
  body: messages.body,
  gifSlug: messages.gifSlug,
  createdAt: messages.createdAt,
};

/**
 * Minimal context: the reported message and the 5 before it in that conversation only.
 * A group report shows the group's latest messages; a person report shows none.
 */
async function contextFor(
  db: DbExecutor,
  report: {
    targetKind: string;
    targetMessageId: string | null;
    targetConversationId: string | null;
  },
) {
  if (!report.targetConversationId) return [];
  if (report.targetKind === "message" && !report.targetMessageId) return [];
  const before =
    report.targetKind === "message" && report.targetMessageId
      ? sql`${messages.id} <= ${report.targetMessageId}::uuid`
      : undefined;
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(and(eq(messages.conversationId, report.targetConversationId), before))
    .orderBy(desc(messages.id))
    .limit(CONTEXT_BEFORE + 1);
  return rows.toReversed();
}

/** One report with who filed it, its target and the conversation context. */
export async function getReport(db: DbExecutor, id: string) {
  const [report] = await db
    .select({
      id: reports.id,
      targetKind: reports.targetKind,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      resolution: reports.resolution,
      resolvedAt: reports.resolvedAt,
      createdAt: reports.createdAt,
      messageExcerpt: reports.messageExcerpt,
      targetMessageId: reports.targetMessageId,
      targetConversationId: reports.targetConversationId,
      conversationName: conversations.name,
      reporterId: reports.reporterId,
      reporterName: reporter.name,
      targetUserId: reports.targetUserId,
      targetName: target.name,
      targetBlocked: sql<boolean>`${target.blockedAt} is not null`,
    })
    .from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(target, eq(target.id, reports.targetUserId))
    .leftJoin(conversations, eq(conversations.id, reports.targetConversationId))
    .where(eq(reports.id, id));
  if (!report) return null;
  return { report, context: await contextFor(db, report) };
}
