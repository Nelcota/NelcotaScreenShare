import { and, eq, lte, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  livekitEvents,
  roomParticipations,
  rooms,
  shareSessions,
  tokenRequests,
  users,
} from "@/server/db/schema";
import { roomDefinitions } from "@/server/db/schema/room-control";
import type { WebhookParticipant } from "./payload";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Window for linking an event to the token request that originated it. */
const TOKEN_WINDOW = sql`interval '15 minutes'`;

/** Room by code; new activity reopens a room that was finished before it. */
export async function ensureRoom(
  tx: DbExecutor,
  code: string,
  at: Date,
  {
    reopen,
    sid,
    authoritative = false,
  }: { reopen: boolean; sid?: string; authoritative?: boolean },
): Promise<string> {
  const reopens = reopen
    ? sql`${rooms.status} = 'finished' and (${authoritative} or excluded.last_activity_at > ${rooms.finishedAt})`
    : sql`false`;
  const [room] = await tx
    .insert(rooms)
    .values({
      code,
      livekitSid: sid,
      startedAt: at,
      lastActivityAt: at,
      // The room's owner: the account that created it through "Criar sala", or its heir.
      createdByUserId: sql`(
        select ${roomDefinitions.ownerUserId} from ${roomDefinitions} where ${roomDefinitions.code} = ${code})`,
    })
    .onConflictDoUpdate({
      target: rooms.code,
      targetWhere: sql`${rooms.deletedAt} is null`,
      set: {
        startedAt: sql`least(${rooms.startedAt}, excluded.started_at)`,
        lastActivityAt: sql`greatest(${rooms.lastActivityAt}, excluded.last_activity_at)`,
        livekitSid: sid
          ? sql`case when ${authoritative} or excluded.last_activity_at >= ${rooms.lastActivityAt} then excluded.livekit_sid else ${rooms.livekitSid} end`
          : sql`${rooms.livekitSid}`,
        status: sql`case when ${reopens} then 'active'::room_status else ${rooms.status} end`,
        finishedAt: sql`case when ${reopens} then null else ${rooms.finishedAt} end`,
      },
    })
    .returning({ id: rooms.id });
  if (!room) throw new Error(`room ${code} was not saved`);
  return room.id;
}

/** Track events carry no joined_at: the event time is used then, corrected when the join arrives. */
function joinedAtOf(participant: WebhookParticipant, fallback: Date): Date {
  if (participant.joinedAtMs) return new Date(participant.joinedAtMs);
  if (participant.joinedAt) return new Date(participant.joinedAt * 1000);
  return fallback;
}

/** Closure already projected after the event, including from an earlier opening. */
async function roomClosureAt(
  tx: DbExecutor,
  roomId: string,
  roomCode: string,
  since: Date,
): Promise<Date | null> {
  const [room] = await tx
    .select({
      closedAt: sql<string | null>`least(
      case when ${rooms.finishedAt} >= ${since}::timestamptz then ${rooms.finishedAt} end,
      (select min(${livekitEvents.occurredAt}) from ${livekitEvents}
        where ${livekitEvents.roomName} = ${roomCode} and ${livekitEvents.event} = 'room_finished'
          and ${livekitEvents.processedAt} is not null
          and ${livekitEvents.occurredAt} >= ${since}::timestamptz))::text`,
    })
    .from(rooms)
    .where(eq(rooms.id, roomId));
  return room?.closedAt ? new Date(room.closedAt) : null;
}

/** Participation by connection sid (join, tracks and leave land on the same row). */
export async function ensureParticipation(
  tx: DbExecutor,
  roomId: string,
  roomCode: string,
  participant: WebhookParticipant,
  at: Date,
  control?: { sessionId?: string; mediaName: string },
): Promise<{ id: string; joinedAt: Date; leftAt: Date | null }> {
  const joinedAt = joinedAtOf(participant, at);
  const userId = UUID.test(participant.identity) ? participant.identity : null;
  // The lock serializes with anonymization, which clears participations after
  // updating the account. A concurrent webhook cannot put the name back.
  const [account] = userId
    ? await tx
        .select({ anonymizedAt: users.anonymizedAt })
        .from(users)
        .where(eq(users.id, userId))
        // The participation trigger also updates the counter on this account;
        // locking for write avoids concurrent promotion of shared locks.
        .for("update")
    : [];
  const keepName = !userId || (account && !account.anonymizedAt);
  const closedAt = await roomClosureAt(tx, roomId, control?.mediaName ?? roomCode, joinedAt);
  const [row] = await tx
    .insert(roomParticipations)
    .values({
      roomId,
      sessionId: control?.sessionId,
      livekitIdentity: participant.identity,
      livekitSid: participant.sid,
      // The identity is the account id (see /api/token); a deleted account becomes null.
      userId: userId ? sql`(select id from users where id = ${userId}::uuid)` : null,
      displayName: keepName && participant.name ? participant.name.slice(0, 32) : null,
      // IP of the token request that granted this join (access record).
      ip: userId
        ? sql`(
            select ${tokenRequests.ip} from ${tokenRequests}
            where ${tokenRequests.userId} = ${userId}::uuid and ${tokenRequests.roomCode} = ${roomCode}
              and ${tokenRequests.result} = 'granted'
              and ${tokenRequests.createdAt} between ${joinedAt}::timestamptz - ${TOKEN_WINDOW}
              and ${joinedAt}::timestamptz + interval '1 minute'
            order by ${tokenRequests.createdAt} desc limit 1)`
        : null,
      joinedAt,
      leftAt: closedAt,
      leaveReason: closedAt ? "room_closed" : null,
    })
    .onConflictDoUpdate({
      target: roomParticipations.livekitSid,
      set: {
        displayName: keepName
          ? sql`coalesce(excluded.display_name, ${roomParticipations.displayName})`
          : null,
        joinedAt: sql`least(${roomParticipations.joinedAt}, excluded.joined_at)`,
        ip: sql`coalesce(${roomParticipations.ip}, excluded.ip)`,
        leftAt: sql`coalesce(${roomParticipations.leftAt}, excluded.left_at)`,
        leaveReason: sql`case when ${roomParticipations.leftAt} is null then coalesce(excluded.leave_reason, ${roomParticipations.leaveReason}) else ${roomParticipations.leaveReason} end`,
      },
    })
    .returning({
      id: roomParticipations.id,
      joinedAt: roomParticipations.joinedAt,
      leftAt: roomParticipations.leftAt,
    });
  if (!row) throw new Error("participation was not saved");
  return row;
}

export async function updatePeak(tx: DbExecutor, roomId: string) {
  await tx
    .update(rooms)
    .set({
      // Aggregate simultaneous arrivals/departures before summing: intervals are [join, leave).
      // Recompute instead of only increasing, since a late leave can correct an inflated peak.
      peakParticipants: sql`(select coalesce(max(online), 0) from (
        select sum(delta) over (order by at) as online from (
          select at, sum(delta) as delta from (
            select joined_at as at, 1 as delta from ${roomParticipations}
              where room_id = ${roomId}
                and (left_at is null or left_at > joined_at)
            union all
            select left_at as at, -1 as delta from ${roomParticipations}
              where room_id = ${roomId} and left_at > joined_at
          ) as boundaries group by at
        ) as changes
      ) as counts)`,
    })
    .where(eq(rooms.id, roomId));
}

export async function closeShares(tx: DbExecutor, where: ReturnType<typeof and>, at: Date) {
  await tx
    .update(shareSessions)
    .set({ endedAt: sql`greatest(${shareSessions.startedAt}, ${at}::timestamptz)` })
    .where(
      and(
        where,
        lte(shareSessions.startedAt, at),
        sql`(${shareSessions.endedAt} is null or ${shareSessions.endedAt} > ${at}::timestamptz)`,
      ),
    );
}
