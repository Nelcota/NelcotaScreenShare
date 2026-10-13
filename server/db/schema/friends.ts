import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, timestamptz, updatedAt } from "./columns";
import { PRESENCE_STATUSES } from "@/features/friends/domain/presence-status";
import { users } from "./user-auth";

export const FRIENDSHIP_STATUSES = ["pending", "accepted"] as const;
export const friendshipStatus = pgEnum("friendship_status", FRIENDSHIP_STATUSES);

/**
 * Friendships between two accounts: one row per pair, stored in id order (low < high), so
 * the primary key also stops a duplicate or crossed request. `requested_by` is who asked;
 * the other one accepts. Deleting or anonymizing an account removes its rows.
 */
export const friendships = pgTable(
  "friendships",
  {
    userLowId: uuid("user_low_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: uuid("user_high_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    acceptedAt: timestamptz("accepted_at"),
    // A request the other side declined, or sent by someone they blocked: the sender still
    // sees it as sent, the receiver no longer sees it. Neither learns about the other.
    dismissedAt: timestamptz("dismissed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userLowId, table.userHighId] }),
    index("friendships_high_idx").on(table.userHighId, table.status),
    check("friendships_order_check", sql`${table.userLowId} < ${table.userHighId}`),
    check(
      "friendships_requester_check",
      sql`${table.requestedBy} in (${table.userLowId}, ${table.userHighId})`,
    ),
    check(
      "friendships_accepted_check",
      sql`(${table.status} = 'accepted') = (${table.acceptedAt} is not null)`,
    ),
    check(
      "friendships_dismissed_check",
      sql`${table.dismissedAt} is null or ${table.status} = 'pending'`,
    ),
  ],
);

/**
 * Who blocked whom. A block ends the friendship, drops pending requests and stops new ones,
 * without telling the blocked person.
 */
export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    index("user_blocks_blocked_idx").on(table.blockedId),
    check("user_blocks_self_check", sql`${table.blockerId} <> ${table.blockedId}`),
  ],
);

/**
 * Personal friend link (/amigo/<token>). The token is derived from a server secret and
 * `version`, so it can be shown again without being stored; only its hash is kept for the
 * lookup. A new link bumps the version and the old one stops working.
 */
export const friendLinks = pgTable(
  "friend_links",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
  },
  (table) => [check("friend_links_version_check", sql`${table.version} > 0`)],
);

/**
 * Each account's friend code, shown as NELC-4K7Q. Stored without the prefix; 4 characters
 * today, room for 5 later without breaking the codes already handed out.
 */
export const friendCodes = pgTable(
  "friend_codes",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdAt: createdAt(),
  },
  (table) => [check("friend_codes_code_check", sql`${table.code} ~ '^[2-9A-HJKMNP-Z]{4,5}$'`)],
);

/**
 * Codes that were replaced or belonged to a deleted account. They are never drawn again, so
 * an old NELC code someone kept cannot reach a different person. No link to any account.
 */
export const retiredFriendCodes = pgTable(
  "retired_friend_codes",
  {
    code: text("code").primaryKey(),
    retiredAt: timestamptz("retired_at").notNull().defaultNow(),
  },
  (table) => [
    check("retired_friend_codes_code_check", sql`${table.code} ~ '^[2-9A-HJKMNP-Z]{4,5}$'`),
  ],
);

export const presenceStatus = pgEnum("presence_status", PRESENCE_STATUSES);

/** The status each person picked (Online, Ausente, Ocupado, Invisível); no row is Online. */
export const userPresence = pgTable("user_presence", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: presenceStatus("status").notNull().default("online"),
  updatedAt: updatedAt(),
});
