import { and, count, eq, gte, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { conversations, messages, reports, users } from "@/server/db/schema";
import { membershipOf } from "@/features/messages/server/conversations.server";
import { ActionError } from "@/server/operations/action-error";
import type { ReportReason } from "@/features/reports/domain/reports";

/** Reports one person can send per hour: enough for real cases, not for flooding the queue. */
const REPORTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

type ReportTarget =
  | { kind: "user"; userId: string }
  | { kind: "message"; messageId: string }
  | { kind: "conversation"; conversationId: string };

export interface ReportInput {
  target: ReportTarget;
  reason: ReportReason;
  details: string | null;
}

interface ResolvedTarget {
  targetKind: ReportTarget["kind"];
  targetUserId: string | null;
  targetMessageId: string | null;
  targetConversationId: string | null;
  messageExcerpt: string | null;
}

const NOT_FOUND = "Não encontramos o que você quer denunciar.";

async function isMember(tx: DbExecutor, conversationId: string, userId: string) {
  return (await membershipOf(tx, conversationId, userId)) !== null;
}

async function userTarget(tx: DbExecutor, userId: string, reporterId: string) {
  if (userId === reporterId) throw new ActionError("Você não pode denunciar a própria conta.");
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  if (!user) throw new ActionError(NOT_FOUND);
  return {
    targetKind: "user",
    targetUserId: user.id,
    targetMessageId: null,
    targetConversationId: null,
    messageExcerpt: null,
  } satisfies ResolvedTarget;
}

/** Only someone in the conversation can report one of its messages. */
async function messageTarget(tx: DbExecutor, messageId: string, reporterId: string) {
  const [message] = await tx
    .select({
      id: messages.id,
      authorId: messages.authorId,
      conversationId: messages.conversationId,
      body: messages.body,
      gifSlug: messages.gifSlug,
    })
    .from(messages)
    .where(eq(messages.id, messageId));
  if (!message || !(await isMember(tx, message.conversationId, reporterId))) {
    throw new ActionError(NOT_FOUND);
  }
  if (message.authorId === reporterId) {
    throw new ActionError("Você não pode denunciar a própria mensagem.");
  }
  return {
    targetKind: "message",
    targetUserId: message.authorId,
    targetMessageId: message.id,
    targetConversationId: message.conversationId,
    messageExcerpt: message.body ?? `GIF: ${message.gifSlug ?? ""}`,
  } satisfies ResolvedTarget;
}

async function conversationTarget(tx: DbExecutor, conversationId: string, reporterId: string) {
  const [conversation] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.kind, "group")));
  if (!conversation || !(await isMember(tx, conversation.id, reporterId))) {
    throw new ActionError(NOT_FOUND);
  }
  return {
    targetKind: "conversation",
    targetUserId: null,
    targetMessageId: null,
    targetConversationId: conversation.id,
    messageExcerpt: null,
  } satisfies ResolvedTarget;
}

function resolveTarget(tx: DbExecutor, target: ReportTarget, reporterId: string) {
  if (target.kind === "user") return userTarget(tx, target.userId, reporterId);
  if (target.kind === "message") return messageTarget(tx, target.messageId, reporterId);
  return conversationTarget(tx, target.conversationId, reporterId);
}

async function checkRate(tx: DbExecutor, reporterId: string, now: Date) {
  const [sent] = await tx
    .select({ value: count() })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        gte(reports.createdAt, new Date(now.getTime() - HOUR_MS)),
      ),
    );
  if ((sent?.value ?? 0) >= REPORTS_PER_HOUR) {
    throw new ActionError("Você já enviou muitas denúncias. Tente de novo mais tarde.");
  }
}

/**
 * Files a report. A second open report of the same target by the same person is a no-op,
 * so repeating it never fills the queue.
 */
export async function createReport(
  tx: DbExecutor,
  reporterId: string,
  input: ReportInput,
  now = new Date(),
): Promise<void> {
  await checkRate(tx, reporterId, now);
  const target = await resolveTarget(tx, input.target, reporterId);
  await tx
    .insert(reports)
    .values({ reporterId, reason: input.reason, details: input.details, ...target })
    .onConflictDoNothing();
}
