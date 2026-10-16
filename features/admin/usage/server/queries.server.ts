import { count, gt, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { userSessions } from "@/server/db/schema";
import { browserName } from "@/lib/user-agent";
import { USAGE_DAYS } from "@/features/admin/usage/domain/period";

const TIME_ZONE = "America/Sao_Paulo";

export interface UsageDay {
  /** "2026-10-11", a day in São Paulo. */
  day: string;
  rooms: number;
  people: number;
  minutes: number;
}

interface UsageRow extends Record<string, unknown> {
  day: string;
  rooms: number;
  people: number;
  minutes: number;
}

/**
 * Rooms opened, distinct people and minutes in rooms per day (São Paulo time), newest first.
 * A stay counts on the day it started; one still open counts until now.
 */
export async function dailyUsage(db: DbExecutor): Promise<UsageDay[]> {
  const result = await db.execute<UsageRow>(sql`
    with bounds as (
      select (now() at time zone ${TIME_ZONE})::date as today
    ),
    days as (
      select generate_series((today - ${USAGE_DAYS - 1}::int)::timestamp, today::timestamp, interval '1 day')::date as day
      from bounds
    ),
    start as (
      select ((today - ${USAGE_DAYS - 1}::int)::timestamp at time zone ${TIME_ZONE}) as at from bounds
    ),
    opened as (
      select (r.started_at at time zone ${TIME_ZONE})::date as day, count(*)::int as rooms
      from rooms r, start
      where r.started_at >= start.at and r.deleted_at is null
      group by 1
    ),
    stays as (
      select (p.joined_at at time zone ${TIME_ZONE})::date as day,
        count(distinct coalesce(p.user_id::text, p.livekit_identity))::int as people,
        round(sum(extract(epoch from coalesce(p.left_at, now()) - p.joined_at)) / 60)::int as minutes
      from room_participations p
      join rooms r on r.id = p.room_id and r.deleted_at is null, start
      where p.joined_at >= start.at
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(opened.rooms, 0) as rooms,
      coalesce(stays.people, 0) as people,
      coalesce(stays.minutes, 0) as minutes
    from days
    left join opened using (day)
    left join stays using (day)
    order by days.day desc`);
  // Every count is cast to int in SQL, which node-postgres reads as a number.
  return result.rows.map(({ day, rooms, people, minutes }) => ({ day, rooms, people, minutes }));
}

export interface SocialDay {
  /** "2026-10-11", a day in São Paulo. */
  day: string;
  messages: number;
  groups: number;
  friendRequests: number;
}

interface SocialRow extends Record<string, unknown> {
  day: string;
  messages: number;
  groups: number;
  friendRequests: number;
}

/**
 * Messages sent, groups created and friend requests per day (São Paulo time), newest first.
 * Counts only, never content or who. What was deleted since no longer counts.
 */
export async function dailySocial(db: DbExecutor): Promise<SocialDay[]> {
  const result = await db.execute<SocialRow>(sql`
    with bounds as (
      select (now() at time zone ${TIME_ZONE})::date as today
    ),
    days as (
      select generate_series((today - ${USAGE_DAYS - 1}::int)::timestamp, today::timestamp, interval '1 day')::date as day
      from bounds
    ),
    start as (
      select ((today - ${USAGE_DAYS - 1}::int)::timestamp at time zone ${TIME_ZONE}) as at from bounds
    ),
    sent as (
      select (m.created_at at time zone ${TIME_ZONE})::date as day, count(*)::int as messages
      from messages m, start
      where m.created_at >= start.at
      group by 1
    ),
    created as (
      select (c.created_at at time zone ${TIME_ZONE})::date as day, count(*)::int as groups
      from conversations c, start
      where c.kind = 'group' and c.created_at >= start.at
      group by 1
    ),
    requested as (
      select (f.created_at at time zone ${TIME_ZONE})::date as day, count(*)::int as requests
      from friendships f, start
      where f.created_at >= start.at
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(sent.messages, 0) as messages,
      coalesce(created.groups, 0) as groups,
      coalesce(requested.requests, 0) as "friendRequests"
    from days
    left join sent using (day)
    left join created using (day)
    left join requested using (day)
    order by days.day desc`);
  return result.rows.map(({ day, messages, groups, friendRequests }) => ({
    day,
    messages,
    groups,
    friendRequests,
  }));
}

export interface BrowserShare {
  browser: string;
  sessions: number;
}

/** Browsers of the sessions still open (ended ones leave no trace), most used first. */
export async function browserShares(db: DbExecutor, now = new Date()): Promise<BrowserShare[]> {
  const rows = await db
    .select({ userAgent: userSessions.userAgent, sessions: count() })
    .from(userSessions)
    .where(gt(userSessions.expiresAt, now))
    .groupBy(userSessions.userAgent);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const browser = browserName(row.userAgent);
    totals.set(browser, (totals.get(browser) ?? 0) + row.sessions);
  }
  return [...totals]
    .map(([browser, sessions]) => ({ browser, sessions }))
    .toSorted((first, second) => second.sessions - first.sessions);
}
