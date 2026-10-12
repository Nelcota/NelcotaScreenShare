import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { adminUsers } from "./admin-auth";
import { createdAt, id, timestamptz, updatedAt } from "./columns";
import { users } from "./user-auth";
import { TOKEN_LOG_RESULTS } from "@/features/room/domain/issue-token";
import { ROOM_CODE_PATTERN } from "@/features/room/domain/room-code";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/**
 * Business data (docs/archive/admin-plan.md §4.3). Rooms, participations and
 * shares are projections of the LiveKit webhooks (`livekit_events`);
 * see `features/room/server/webhook/projector.server.ts`.
 */
export const roomStatus = pgEnum("room_status", ["active", "finished"]);

export const rooms = pgTable(
  "rooms",
  {
    id: id(),
    code: text("code").notNull(),
    status: roomStatus("status").notNull().default("active"),
    // sid of the current instance in LiveKit (changes when the room is reopened).
    livekitSid: text("livekit_sid"),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    lastActivityAt: timestamptz("last_activity_at").notNull().defaultNow(),
    peakParticipants: smallint("peak_participants").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    closedByAdminId: uuid("closed_by_admin_id").references(() => adminUsers.id),
    note: text("note"),
    deletedAt: timestamptz("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("rooms_code_check", sql.raw(`code ~ '${ROOM_CODE_PATTERN}'`)),
    check("rooms_note_check", sql`length(${table.note}) <= 500`),
    check("rooms_peak_check", sql`${table.peakParticipants} >= 0`),
    check(
      "rooms_finished_check",
      sql`${table.finishedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
    // The same code can be reopened: only one "live" (not deleted) room per code.
    uniqueIndex("rooms_code_live_key")
      .on(table.code)
      .where(sql`${table.deletedAt} is null`),
    index("rooms_activity_idx")
      .on(table.status, table.lastActivityAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("rooms_activity_all_idx")
      .on(table.lastActivityAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("rooms_started_idx")
      .on(table.startedAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("rooms_peak_idx")
      .on(table.peakParticipants.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("rooms_code_search_idx")
      .using("gin", sql`${table.code} gin_trgm_ops`)
      .where(sql`${table.deletedAt} is null`),
    index("rooms_created_by_idx").on(table.createdByUserId),
  ],
);

export const leaveReason = pgEnum("participant_leave_reason", [
  "left",
  "disconnected",
  "removed_by_admin",
  "room_closed",
  "unknown",
]);

export const roomParticipations = pgTable(
  "room_participations",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // = users.id in the token.
    livekitIdentity: text("livekit_identity").notNull(),
    // sid of the connection in LiveKit (PA_…): comes in every participant event,
    // including track events, which do not carry joined_at.
    livekitSid: text("livekit_sid").notNull(),
    // Anonymizable (LGPD, 12 months).
    displayName: text("display_name"),
    // Access record (Marco Civil): becomes NULL after 6 months.
    ip: inet("ip"),
    joinedAt: timestamptz("joined_at").notNull(),
    leftAt: timestamptz("left_at"),
    leaveReason: leaveReason("leave_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // One row per connection: join, tracks and leave land on the same row.
    uniqueIndex("room_participations_livekit_sid_key").on(table.livekitSid),
    check("room_participations_name_check", sql`length(${table.displayName}) <= 32`),
    check(
      "room_participations_left_check",
      sql`${table.leftAt} is null or ${table.leftAt} >= ${table.joinedAt}`,
    ),
    index("room_participations_room_idx").on(table.roomId, table.joinedAt.desc()),
    index("room_participations_user_idx").on(table.userId, table.joinedAt.desc()),
    index("room_participations_online_idx")
      .on(table.roomId)
      .where(sql`${table.leftAt} is null`),
  ],
);

export const shareSessions = pgTable(
  "share_sessions",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    participationId: uuid("participation_id")
      .notNull()
      .references(() => roomParticipations.id, { onDelete: "restrict" }),
    trackSid: text("track_sid").notNull().unique(),
    withAudio: boolean("with_audio").notNull().default(false),
    startedAt: timestamptz("started_at").notNull(),
    endedAt: timestamptz("ended_at"),
    durationSeconds: integer("duration_seconds").generatedAlwaysAs(
      sql`CASE WHEN ended_at IS NULL THEN NULL ELSE floor(extract(epoch FROM ended_at - started_at))::int END`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "share_sessions_ended_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
    index("share_sessions_started_idx").on(table.startedAt.desc(), table.id.desc()),
    index("share_sessions_room_idx").on(table.roomId, table.startedAt.desc()),
    index("share_sessions_participation_idx").on(table.participationId),
    index("share_sessions_active_idx")
      .on(table.roomId)
      .where(sql`${table.endedAt} is null`),
  ],
);

/** Invitation with expiry/usage limit. The token only exists as a hash. */
export const roomInvites = pgTable(
  "room_invites",
  {
    id: id(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    tokenHash: bytea("token_hash").notNull().unique(),
    label: text("label"),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamptz("expires_at"),
    revokedAt: timestamptz("revoked_at"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => adminUsers.id),
    deletedAt: timestamptz("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("room_invites_label_check", sql`length(${table.label}) <= 80`),
    check("room_invites_max_uses_check", sql`${table.maxUses} > 0`),
    check("room_invites_uses_check", sql`${table.uses} >= 0`),
    check(
      "room_invites_limit_check",
      sql`${table.maxUses} is null or ${table.uses} <= ${table.maxUses}`,
    ),
    index("room_invites_room_idx").on(table.roomId, table.createdAt.desc()),
  ],
);

/**
 * Who has already used each invitation: the limit counts people, not joins (returning
 * to the room with the same invitation does not spend another use).
 */
export const roomInviteUses = pgTable(
  "room_invite_uses",
  {
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => roomInvites.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.inviteId, table.userId] })],
);

export const tokenResult = pgEnum("token_result", TOKEN_LOG_RESULTS);

/** Every request to /api/token (insert-only; 6-month retention). */
export const tokenRequests = pgTable(
  "token_requests",
  {
    id: id(),
    roomCode: text("room_code").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    result: tokenResult("result").notNull(),
    ip: inet("ip"),
    createdAt: createdAt(),
  },
  (table) => [
    check("token_requests_room_code_check", sql`length(${table.roomCode}) <= 64`),
    index("token_requests_created_brin").using("brin", table.createdAt),
    index("token_requests_ip_idx").on(table.ip, table.createdAt.desc()),
    index("token_requests_user_idx").on(table.userId, table.roomCode, table.createdAt.desc()),
  ],
);

/** Raw webhook: the event id guarantees idempotency; pending ones can be reprocessed. */
export const livekitEvents = pgTable(
  "livekit_events",
  {
    id: text("id").primaryKey(),
    event: text("event").notNull(),
    roomName: text("room_name"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    // Time of the event in LiveKit (orders reprocessing).
    occurredAt: timestamptz("occurred_at").notNull(),
    receivedAt: timestamptz("received_at").notNull().defaultNow(),
    processedAt: timestamptz("processed_at"),
    error: text("error"),
  },
  (table) => [
    index("livekit_events_pending_idx")
      .on(table.occurredAt)
      .where(sql`${table.processedAt} is null`),
    index("livekit_events_received_idx").on(table.receivedAt.desc()),
    index("livekit_events_identity_idx").on(sql`(${table.payload}->'participant'->>'identity')`),
    // Publications and their ending lookups must not scan every room's raw history.
    index("livekit_events_track_idx").on(
      table.roomName,
      table.event,
      sql`(${table.payload}->'participant'->>'sid')`,
      sql`(${table.payload}->'track'->>'sid')`,
      table.occurredAt,
    ),
  ],
);
