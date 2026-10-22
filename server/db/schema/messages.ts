import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ATTACHMENT_KINDS } from "@/features/messages/domain/attachments";
import { createdAt, id, timestamptz } from "./columns";
import { users } from "./user-auth";

export const CONVERSATION_KINDS = ["direct", "group"] as const;
export const conversationKind = pgEnum("conversation_kind", CONVERSATION_KINDS);

/**
 * A direct conversation between two friends, or a group of up to 10 people. A direct one
 * stores its pair in id order (low < high), so the unique index keeps one per pair. Messages
 * stay until their author deletes them; the room chat is a different thing and is never stored.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    kind: conversationKind("kind").notNull(),
    name: text("name"),
    directLowId: uuid("direct_low_id").references(() => users.id, { onDelete: "cascade" }),
    directHighId: uuid("direct_high_id").references(() => users.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    lastMessageAt: timestamptz("last_message_at"),
  },
  (table) => [
    uniqueIndex("conversations_direct_pair_idx")
      .on(table.directLowId, table.directHighId)
      .where(sql`${table.kind} = 'direct'`),
    check(
      "conversations_kind_check",
      sql`(${table.kind} = 'direct' and ${table.directLowId} is not null and ${table.directHighId} is not null and ${table.directLowId} < ${table.directHighId} and ${table.name} is null)
        or (${table.kind} = 'group' and ${table.directLowId} is null and ${table.directHighId} is null)`,
    ),
    check(
      "conversations_name_check",
      sql`${table.name} is null or char_length(${table.name}) between 1 and 60`,
    ),
  ],
);

/** Who is in each conversation and up to when they have read it. */
export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
    lastReadAt: timestamptz("last_read_at"),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_members_user_idx").on(table.userId),
  ],
);

/**
 * A text, a GIF or an attachment (with an optional text). Only the GIF's slug is kept, never a
 * copy of the media; an attachment lives in the file storage (message_attachments).
 */
export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body"),
    gifSlug: text("gif_slug"),
    createdAt: createdAt(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId, table.id),
    index("messages_author_idx").on(table.authorId),
    // At most one of text and GIF; a message with neither carries an attachment (the server checks).
    check("messages_content_check", sql`${table.body} is null or ${table.gifSlug} is null`),
    check(
      "messages_body_check",
      sql`${table.body} is null or char_length(${table.body}) between 1 and 2000`,
    ),
    check(
      "messages_gif_slug_check",
      sql`${table.gifSlug} is null or char_length(${table.gifSlug}) between 1 and 200`,
    ),
  ],
);

export const ATTACHMENT_STATUSES = ["pending", "ready"] as const;
export const attachmentStatus = pgEnum("attachment_status", ATTACHMENT_STATUSES);

export const attachmentKind = pgEnum("attachment_kind", ATTACHMENT_KINDS);

/**
 * A file sent in a conversation (ADR 0011). The file itself is in the storage under
 * `object_key`; this row says whose it is and what it is. `pending` until the server has
 * checked the real size and type after the upload; `message_id` is set when the message goes.
 * The links are set to null instead of cascading, so the cleanup still knows which object to
 * delete after the message, the conversation or the account is gone.
 */
export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: id(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    uploaderId: uuid("uploader_id").references(() => users.id, { onDelete: "set null" }),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    status: attachmentStatus("status").notNull().default("pending"),
    kind: attachmentKind("kind"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    createdAt: createdAt(),
    confirmedAt: timestamptz("confirmed_at"),
  },
  (table) => [
    uniqueIndex("message_attachments_object_key_idx").on(table.objectKey),
    index("message_attachments_message_idx").on(table.messageId),
    index("message_attachments_uploader_idx").on(table.uploaderId),
    check(
      "message_attachments_file_name_check",
      sql`char_length(${table.fileName}) between 1 and 200`,
    ),
    check(
      "message_attachments_ready_check",
      sql`${table.status} = 'pending' or (${table.kind} is not null and ${table.sizeBytes} is not null)`,
    ),
  ],
);

/** Each person's favourite GIFs, by slug only. */
export const gifFavorites = pgTable(
  "gif_favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.slug] }),
    check("gif_favorites_slug_check", sql`char_length(${table.slug}) between 1 and 200`),
  ],
);

/**
 * Calls started for a whole group: the room they happen in, who started it and when. The
 * conversation shows "Chamada em andamento" while that room's call is live, and a line in
 * the timeline. Goes away with the group.
 */
export const conversationCalls = pgTable(
  "conversation_calls",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    roomCode: text("room_code").notNull(),
    startedBy: uuid("started_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
  },
  (table) => [
    index("conversation_calls_conversation_idx").on(table.conversationId, table.startedAt),
  ],
);
