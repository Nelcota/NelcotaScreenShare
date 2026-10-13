import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  REPORT_REASONS,
  REPORT_RESOLUTIONS,
  REPORT_STATUSES,
  REPORT_TARGET_KINDS,
} from "@/features/reports/domain/reports";
import { adminUsers } from "./admin-auth";
import { createdAt, id, timestamptz } from "./columns";
import { conversations, messages } from "./messages";
import { users } from "./user-auth";

export const reportTargetKind = pgEnum("report_target_kind", REPORT_TARGET_KINDS);
export const reportReason = pgEnum("report_reason", REPORT_REASONS);
export const reportStatus = pgEnum("report_status", REPORT_STATUSES);
export const reportResolution = pgEnum("report_resolution", REPORT_RESOLUTIONS);

/**
 * A report of a person, a message or a group. The reported person never learns who
 * reported. A message report keeps a copy of that one message (authors can delete
 * messages for good) only while the report is open.
 */
export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetKind: reportTargetKind("target_kind").notNull(),
    // The person reported, or the author of the reported message.
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    targetMessageId: uuid("target_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    // The reported group, or the conversation of the reported message (for context).
    targetConversationId: uuid("target_conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageExcerpt: text("message_excerpt"),
    reason: reportReason("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    resolution: reportResolution("resolution"),
    resolvedByAdminId: uuid("resolved_by_admin_id").references(() => adminUsers.id),
    resolvedAt: timestamptz("resolved_at"),
    createdAt: createdAt(),
  },
  (table) => [
    check("reports_details_check", sql`char_length(${table.details}) <= 500`),
    check("reports_excerpt_check", sql`char_length(${table.messageExcerpt}) <= 2000`),
    check(
      "reports_resolution_check",
      sql`(${table.status} = 'open' and ${table.resolution} is null and ${table.resolvedAt} is null)
        or (${table.status} = 'resolved' and ${table.resolution} is not null and ${table.resolvedAt} is not null)`,
    ),
    index("reports_queue_idx").on(table.status, table.createdAt.desc(), table.id.desc()),
    index("reports_reporter_idx").on(table.reporterId, table.createdAt.desc()),
    index("reports_target_user_idx").on(table.targetUserId),
    // One open report per person and target: repeating it adds nothing to the queue.
    uniqueIndex("reports_open_unique_idx")
      .on(
        table.reporterId,
        table.targetKind,
        sql`coalesce(${table.targetMessageId}, ${table.targetConversationId}, ${table.targetUserId})`,
      )
      .where(sql`${table.status} = 'open'`),
  ],
);
