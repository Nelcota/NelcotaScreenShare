import { z } from "zod";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions, roomSessions } from "@/server/db/schema/room-control";
import { roomFavorites } from "@/server/db/schema/room-favorites";
import { teamMembers, teams } from "@/server/db/schema/workspaces";
import {
  membership,
  requireMembership,
  workspaceAccount,
} from "@/features/team/server/access.server";
import { managesTeam } from "@/features/team/domain/team-policy";
import { accessibleDefinition } from "./room-access.server";

export async function workspaceRooms(db: DbExecutor, actor: string, teamId?: string) {
  await workspaceAccount(db, actor);
  if (teamId) await requireMembership(db, teamId, actor);
  const memberTeams = db
    .select({ id: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, actor), isNull(teams.deletedAt)));
  const visibility = teamId
    ? eq(roomDefinitions.teamId, teamId)
    : or(
        and(eq(roomDefinitions.kind, "personal"), eq(roomDefinitions.ownerUserId, actor)),
        inArray(roomDefinitions.teamId, memberTeams),
      );
  const rows = await db
    .select({ room: roomDefinitions, favorite: sql<boolean>`${roomFavorites.userId} is not null` })
    .from(roomDefinitions)
    .leftJoin(
      roomFavorites,
      and(eq(roomFavorites.roomId, roomDefinitions.id), eq(roomFavorites.userId, actor)),
    )
    .where(visibility)
    .orderBy(desc(roomDefinitions.createdAt), desc(roomDefinitions.id))
    .limit(200);
  const result = [];
  for (const row of rows) {
    const team = row.room.teamId ? await membership(db, row.room.teamId, actor) : undefined;
    result.push({
      ...row.room,
      favorite: row.favorite,
      canManage: row.room.kind === "personal" || Boolean(team && managesTeam(team.role)),
    });
  }
  return result;
}
export async function sessionHistory(
  db: DbExecutor,
  actor: string,
  roomId: string,
  cursor?: string,
) {
  await accessibleDefinition(db, roomId, actor);
  const before = historyCursor(cursor);
  const { at, id } = before ?? {};
  const rows = await db
    .select({
      id: roomSessions.id,
      startedAt: roomSessions.startedAt,
      createdAt: roomSessions.createdAt,
      closedAt: roomSessions.closedAt,
      status: roomSessions.status,
      participants: roomSessions.participantCount,
      shares: sql<number>`(select count(*)::int from share_sessions sh inner join room_participations rp on rp.id = sh.participation_id where rp.session_id = room_sessions.id)`,
    })
    .from(roomSessions)
    .where(
      and(
        eq(roomSessions.definitionId, roomId),
        at && id
          ? sql`(${roomSessions.createdAt}, ${roomSessions.id}) < (${at}::timestamptz, ${id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(roomSessions.createdAt), desc(roomSessions.id))
    .limit(51);
  const items = rows.slice(0, 50);
  const last = items.at(-1);
  return {
    items,
    next: rows.length > 50 && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
  };
}

function historyCursor(cursor: string | undefined) {
  const [at, id] = cursor?.split("_") ?? [];
  const parsed = z.object({ at: z.iso.datetime(), id: z.uuid() }).safeParse({ at, id });
  return parsed.success ? parsed.data : undefined;
}
