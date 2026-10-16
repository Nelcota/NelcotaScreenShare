import { and, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomJoinRequests, tokenRequests, users } from "@/server/db/schema";
import {
  isTokenDenialReason,
  type DenialReason,
  type TokenDenialReason,
} from "@/features/admin/entries/domain/reasons";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SHOWN = 50;

/** Keeps only denied requests, narrowed to their reason. */
function onlyDenials<T extends { reason: string }>(rows: T[]) {
  return rows.flatMap((row) =>
    isTokenDenialReason(row.reason) ? [{ ...row, reason: row.reason }] : [],
  );
}

export interface ReasonCount {
  reason: DenialReason;
  lastDay: number;
  lastWeek: number;
}

async function tokenDenialCounts(db: DbExecutor, now: Date) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const lastDay = count(sql`case when ${tokenRequests.createdAt} >= ${dayAgo} then 1 end`);
  const rows = await db
    .select({ reason: tokenRequests.result, lastDay, lastWeek: count() })
    .from(tokenRequests)
    .where(
      and(
        ne(tokenRequests.result, "granted"),
        gte(tokenRequests.createdAt, new Date(now.getTime() - 7 * DAY_MS)),
      ),
    )
    .groupBy(tokenRequests.result);
  return onlyDenials(rows);
}

/** Requests the owner or a moderator turned down, by when they decided. */
async function declinedJoinCount(db: DbExecutor, now: Date): Promise<ReasonCount[]> {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [row] = await db
    .select({
      lastDay: count(sql`case when ${roomJoinRequests.decidedAt} >= ${dayAgo} then 1 end`),
      lastWeek: count(),
    })
    .from(roomJoinRequests)
    .where(
      and(
        eq(roomJoinRequests.status, "declined"),
        gte(roomJoinRequests.decidedAt, new Date(now.getTime() - 7 * DAY_MS)),
      ),
    );
  if (!row || row.lastWeek === 0) return [];
  return [{ reason: "join_declined", lastDay: row.lastDay, lastWeek: row.lastWeek }];
}

function byFrequency(first: ReasonCount, second: ReasonCount): number {
  return (
    second.lastWeek - first.lastWeek ||
    second.lastDay - first.lastDay ||
    first.reason.localeCompare(second.reason)
  );
}

/** Denied joins per reason in the last 24 hours and 7 days, most frequent first. */
export async function denialsByReason(db: DbExecutor, now = new Date()): Promise<ReasonCount[]> {
  const [tokens, declined] = await Promise.all([
    tokenDenialCounts(db, now),
    declinedJoinCount(db, now),
  ]);
  return [...tokens, ...declined].toSorted(byFrequency);
}

export interface DenialRow {
  id: string;
  reason: DenialReason;
  roomCode: string;
  userId: string | null;
  userName: string | null;
  createdAt: Date;
}

async function recentTokenDenials(
  db: DbExecutor,
  reason: TokenDenialReason | null,
): Promise<DenialRow[]> {
  const rows = await db
    .select({
      id: tokenRequests.id,
      reason: tokenRequests.result,
      roomCode: tokenRequests.roomCode,
      userId: tokenRequests.userId,
      userName: users.name,
      createdAt: tokenRequests.createdAt,
    })
    .from(tokenRequests)
    .leftJoin(users, eq(users.id, tokenRequests.userId))
    .where(reason ? eq(tokenRequests.result, reason) : ne(tokenRequests.result, "granted"))
    .orderBy(desc(tokenRequests.createdAt), desc(tokenRequests.id))
    .limit(RECENT_SHOWN);
  return onlyDenials(rows);
}

async function recentDeclinedJoins(db: DbExecutor): Promise<DenialRow[]> {
  const rows = await db
    .select({
      id: roomJoinRequests.id,
      roomCode: roomJoinRequests.roomCode,
      userId: roomJoinRequests.userId,
      userName: users.name,
      decidedAt: roomJoinRequests.decidedAt,
    })
    .from(roomJoinRequests)
    .leftJoin(users, eq(users.id, roomJoinRequests.userId))
    .where(eq(roomJoinRequests.status, "declined"))
    .orderBy(desc(roomJoinRequests.decidedAt), desc(roomJoinRequests.id))
    .limit(RECENT_SHOWN);
  return rows.flatMap(({ decidedAt, ...row }) =>
    decidedAt ? [{ ...row, reason: "join_declined" as const, createdAt: decidedAt }] : [],
  );
}

/** The latest denied joins, optionally of one reason. No IP: only room, account and time. */
export async function recentDenials(
  db: DbExecutor,
  reason: DenialReason | null,
): Promise<DenialRow[]> {
  if (reason === "join_declined") return recentDeclinedJoins(db);
  if (reason) return recentTokenDenials(db, reason);
  const [tokens, declined] = await Promise.all([
    recentTokenDenials(db, null),
    recentDeclinedJoins(db),
  ]);
  return [...tokens, ...declined]
    .toSorted((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
    .slice(0, RECENT_SHOWN);
}
