import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, timestamptz, updatedAt } from "./columns";
import { users } from "./user-auth";
import type { TeamRole } from "@/features/team/domain/team-policy";

export const teams = pgTable(
  "teams",
  {
    id: id(),
    name: text("name").notNull(),
    deletedAt: timestamptz("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("teams_name_check", sql`length(${t.name}) between 2 and 80`)],
);
export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<TeamRole>().notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    check("team_members_role_check", sql`${t.role} in ('owner', 'manager', 'member')`),
    uniqueIndex("team_members_owner_key")
      .on(t.teamId)
      .where(sql`${t.role} = 'owner'`),
    index("team_members_user_idx").on(t.userId, t.teamId),
  ],
);
export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: id(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    role: text("role").$type<"manager" | "member">().notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    revokedAt: timestamptz("revoked_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("team_invitations_role_check", sql`${t.role} in ('manager', 'member')`),
    check("team_invitations_email_check", sql`length(${t.email}) <= 254`),
    index("team_invitations_team_idx").on(t.teamId, t.createdAt),
    index("team_invitations_expiry_idx").on(t.expiresAt),
  ],
);
export const proEntitlements = pgTable(
  "pro_entitlements",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(false),
    roomLimit: integer("room_limit").notNull().default(3),
    expiresAt: timestamptz("expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "pro_entitlements_subject_check",
      sql`(${t.userId} is not null) <> (${t.teamId} is not null)`,
    ),
    check("pro_entitlements_limit_check", sql`${t.roomLimit} between 1 and 50`),
    uniqueIndex("pro_entitlements_user_key")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
    uniqueIndex("pro_entitlements_team_key")
      .on(t.teamId)
      .where(sql`${t.teamId} is not null`),
  ],
);
