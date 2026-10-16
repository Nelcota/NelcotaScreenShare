import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, timestamptz } from "./columns";
import { users } from "./user-auth";
import { adminUsers } from "./admin-auth";
import { ROOM_CODE_PATTERN } from "@/features/room/domain/room-code";
import type { SharePolicy } from "@/features/room/domain/host-controls";
import { teams } from "./workspaces";

/** Application authority, independent of the webhook history projection. */
export const roomDefinitions = pgTable(
  "room_definitions",
  {
    id: id(),
    code: text("code").notNull().unique(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").$type<"ad_hoc" | "personal" | "team">().notNull().default("ad_hoc"),
    name: text("name"),
    teamId: uuid("team_id").references(() => teams.id),
    allowGuests: boolean("allow_guests").notNull().default(true),
    memberCanHost: boolean("member_can_host").notNull().default(false),
    archivedAt: timestamptz("archived_at"),
    closedAt: timestamptz("closed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("room_definitions_code_check", sql.raw(`code ~ '${ROOM_CODE_PATTERN}'`)),
    check("room_definitions_kind_check", sql`${t.kind} in ('ad_hoc', 'personal', 'team')`),
    check(
      "room_definitions_name_check",
      sql`${t.name} is null or length(${t.name}) between 2 and 80`,
    ),
    check("room_definitions_team_check", sql`(${t.kind} = 'team') = (${t.teamId} is not null)`),
    index("room_definitions_owner_idx").on(t.ownerUserId, t.createdAt),
    index("room_definitions_team_idx").on(t.teamId, t.createdAt),
  ],
);

export const roomSessions = pgTable(
  "room_sessions",
  {
    id: id(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => roomDefinitions.id),
    mediaRoomName: text("media_room_name").notNull().unique(),
    hostUserId: uuid("host_user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<"pending" | "active" | "closed">().notNull().default("pending"),
    admissionLocked: boolean("admission_locked").notNull().default(false),
    sharePolicy: text("share_policy").$type<SharePolicy>().notNull().default("everyone"),
    allowedSharers: jsonb("allowed_sharers").$type<string[]>().notNull().default([]),
    hostMissingAt: timestamptz("host_missing_at"),
    // When the owner handed the host over: the owner takes it back only after joining again.
    hostGivenAt: timestamptz("host_given_at"),
    emptySince: timestamptz("empty_since"),
    closedAt: timestamptz("closed_at"),
    startedAt: timestamptz("started_at"),
    participantCount: integer("participant_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("room_sessions_status_check", sql`${table.status} in ('pending', 'active', 'closed')`),
    check(
      "room_sessions_policy_check",
      sql`${table.sharePolicy} in ('everyone', 'host', 'selected')`,
    ),
    uniqueIndex("room_sessions_one_open_idx")
      .on(table.definitionId)
      .where(sql`${table.status} <> 'closed'`),
    index("room_sessions_definition_history_idx").on(table.definitionId, table.createdAt, table.id),
    index("room_sessions_open_idx").on(table.status, table.updatedAt),
  ],
);

export const roomSessionMembers = pgTable(
  "room_session_members",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => roomSessions.id, { onDelete: "cascade" }),
    identity: text("identity").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    admittedAt: timestamptz("admitted_at"),
    reservedUntil: timestamptz("reserved_until").notNull(),
    excludedAt: timestamptz("excluded_at"),
    // Who removed them: the host, the owner or a moderator, or an admin from the panel.
    excludedByUserId: uuid("excluded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    excludedByAdminId: uuid("excluded_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.identity] }),
    check("room_session_members_identity_check", sql`length(${table.identity}) between 1 and 128`),
    index("room_session_members_user_idx").on(table.userId),
  ],
);

export const roomCommands = pgTable(
  "room_commands",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => roomSessions.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"sync" | "remove" | "close">().notNull(),
    targetIdentity: text("target_identity"),
    status: text("status").$type<"pending" | "applied" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamptz("next_attempt_at").notNull().defaultNow(),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("room_commands_kind_check", sql`${table.kind} in ('sync', 'remove', 'close')`),
    check("room_commands_status_check", sql`${table.status} in ('pending', 'applied', 'failed')`),
    index("room_commands_retry_idx")
      .on(table.nextAttemptAt)
      .where(sql`${table.status} <> 'applied'`),
  ],
);
