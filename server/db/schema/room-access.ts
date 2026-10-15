import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { JOIN_REQUEST_STATUSES, ROOM_ACCESS_MODES } from "@/features/room/domain/room-access";
import { createdAt, id, timestamptz, updatedAt } from "./columns";
import { roomDefinitions } from "./room-control";
import { users } from "./user-auth";

export const roomAccessMode = pgEnum("room_access", ROOM_ACCESS_MODES);

/**
 * How people get into a room, saved per code like its roles. "open": anyone with the link
 * joins; "approval": everyone except the owner and moderators asks first. No row means open.
 */
export const roomSettings = pgTable("room_settings", {
  roomCode: text("room_code")
    .primaryKey()
    .references(() => roomDefinitions.code, { onDelete: "cascade" }),
  access: roomAccessMode("access").notNull().default("open"),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const joinRequestStatus = pgEnum("join_request_status", JOIN_REQUEST_STATUSES);

/**
 * Someone asking to enter a room with approval: an account or a guest (by the signed cookie
 * id). A pending request lapses at `expires_at`; an accepted one admits that person once,
 * within a few minutes, and `used_at` records it. Old rows are cleared by maintenance.
 */
export const roomJoinRequests = pgTable(
  "room_join_requests",
  {
    id: id(),
    roomCode: text("room_code")
      .notNull()
      .references(() => roomDefinitions.code, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id"),
    displayName: text("display_name").notNull(),
    status: joinRequestStatus("status").notNull().default("pending"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    expiresAt: timestamptz("expires_at").notNull(),
    decidedAt: timestamptz("decided_at"),
    usedAt: timestamptz("used_at"),
  },
  (table) => [
    check(
      "room_join_requests_requester_check",
      sql`num_nonnulls(${table.userId}, ${table.guestId}) = 1`,
    ),
    check("room_join_requests_name_check", sql`length(${table.displayName}) between 1 and 64`),
    uniqueIndex("room_join_requests_pending_key")
      .on(table.roomCode, sql`coalesce(${table.userId}, ${table.guestId})`)
      .where(sql`${table.status} = 'pending'`),
    index("room_join_requests_room_idx").on(table.roomCode, table.createdAt.desc()),
  ],
);
