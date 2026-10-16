import { and, asc, desc, eq, gt, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import {
  JOIN_APPROVAL_VALID_MS,
  JOIN_REQUEST_WAIT_MS,
  type JoinRequestStatus,
} from "@/features/room/domain/room-access";
import type { DbExecutor } from "@/server/db/index.server";
import { roomJoinRequests } from "@/server/db/schema";

/** Who is asking: an account or a guest (the id from the signed cookie). */
export type JoinRequester = { userId: string } | { guestId: string };

function requesterCondition(requester: JoinRequester): SQL | undefined {
  if ("userId" in requester) return eq(roomJoinRequests.userId, requester.userId);
  return eq(roomJoinRequests.guestId, requester.guestId);
}

function secondsFromNow(ms: number) {
  return sql`now() + make_interval(secs => ${ms / 1000})`;
}

/** Pending requests past their wait become expired, so a new one can be opened. */
async function expireStale(db: DbExecutor, roomCode: string) {
  await db
    .update(roomJoinRequests)
    .set({ status: "expired" })
    .where(
      and(
        eq(roomJoinRequests.roomCode, roomCode),
        eq(roomJoinRequests.status, "pending"),
        lte(roomJoinRequests.expiresAt, sql`now()`),
      ),
    );
}

/**
 * Uses an accepted request to let its owner in, once: the given one or, without an id (the
 * person clicked to join again or reloaded the page), their latest approval in the room.
 * Returns its id when there was one, accepted recently and not used yet.
 */
export async function consumeApproval(
  db: DbExecutor,
  {
    roomCode,
    requester,
    requestId,
  }: { roomCode: string; requester: JoinRequester; requestId: string | undefined },
): Promise<string | null> {
  const usable = and(
    eq(roomJoinRequests.roomCode, roomCode),
    requesterCondition(requester),
    eq(roomJoinRequests.status, "accepted"),
    isNull(roomJoinRequests.usedAt),
    gt(
      roomJoinRequests.decidedAt,
      sql`now() - make_interval(secs => ${JOIN_APPROVAL_VALID_MS / 1000})`,
    ),
  );
  const latest = db
    .select({ id: roomJoinRequests.id })
    .from(roomJoinRequests)
    .where(requestId === undefined ? usable : and(usable, eq(roomJoinRequests.id, requestId)))
    .orderBy(desc(roomJoinRequests.decidedAt))
    .limit(1);
  // One statement: two token requests at once cannot both use the same approval.
  const used = await db
    .update(roomJoinRequests)
    .set({ usedAt: sql`now()` })
    .where(and(inArray(roomJoinRequests.id, latest), isNull(roomJoinRequests.usedAt)))
    .returning({ id: roomJoinRequests.id });
  return used[0]?.id ?? null;
}

/** Gives an approval back when the person could not get in after all (signing failed). */
export async function restoreApproval(db: DbExecutor, requestId: string) {
  await db.update(roomJoinRequests).set({ usedAt: null }).where(eq(roomJoinRequests.id, requestId));
}

/** Requests waiting in one room at most: enough for a real crowd, a ceiling for a flood. */
/** A queue a host can still read through; past it the door says the room is full. */
export const MAX_PENDING_PER_ROOM = 15;

async function pendingCount(db: DbExecutor, roomCode: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(roomJoinRequests)
    .where(and(eq(roomJoinRequests.roomCode, roomCode), eq(roomJoinRequests.status, "pending")));
  return row?.total ?? 0;
}

async function ownPending(db: DbExecutor, roomCode: string, requester: JoinRequester) {
  const [row] = await db
    .select({ id: roomJoinRequests.id })
    .from(roomJoinRequests)
    .where(
      and(
        eq(roomJoinRequests.roomCode, roomCode),
        requesterCondition(requester),
        eq(roomJoinRequests.status, "pending"),
      ),
    );
  return row?.id ?? null;
}

/**
 * The person's pending request in the room, opened now if there is none. A new one needs
 * room in the queue and `mayOpen` (the caller's rate limit); otherwise null.
 */
export async function openJoinRequest(
  db: DbExecutor,
  {
    roomCode,
    requester,
    displayName,
    mayOpen = () => true,
  }: {
    roomCode: string;
    requester: JoinRequester;
    displayName: string;
    mayOpen?: () => boolean;
  },
): Promise<string | null> {
  await expireStale(db, roomCode);
  const existing = await ownPending(db, roomCode, requester);
  if (existing) return existing;
  if ((await pendingCount(db, roomCode)) >= MAX_PENDING_PER_ROOM) return null;
  if (!mayOpen()) return null;
  const owner =
    "userId" in requester ? { userId: requester.userId } : { guestId: requester.guestId };
  const [opened] = await db
    .insert(roomJoinRequests)
    .values({ roomCode, ...owner, displayName, expiresAt: secondsFromNow(JOIN_REQUEST_WAIT_MS) })
    .onConflictDoNothing()
    .returning({ id: roomJoinRequests.id });
  if (opened) return opened.id;
  // A pending one already existed. It may have been answered in between, so the latest
  // request is the one to follow, whatever its status: the waiting page reads it.
  const [latest] = await db
    .select({ id: roomJoinRequests.id })
    .from(roomJoinRequests)
    .where(and(eq(roomJoinRequests.roomCode, roomCode), requesterCondition(requester)))
    .orderBy(desc(roomJoinRequests.createdAt))
    .limit(1);
  if (!latest) throw new Error("join request was not opened");
  return latest.id;
}

/** Where a request stands, for the person waiting; null when it is not theirs. */
export async function joinRequestStatus(
  db: DbExecutor,
  { requestId, requester }: { requestId: string; requester: JoinRequester },
): Promise<JoinRequestStatus | null> {
  const [row] = await db
    .select({
      status: roomJoinRequests.status,
      lapsed: sql<boolean>`${roomJoinRequests.expiresAt} <= now()`,
    })
    .from(roomJoinRequests)
    .where(and(eq(roomJoinRequests.id, requestId), requesterCondition(requester)));
  if (!row) return null;
  if (row.status === "pending" && row.lapsed) return "expired";
  return row.status;
}

export interface PendingJoinRequest {
  id: string;
  name: string;
  guest: boolean;
}

/** Requests still waiting in the room, oldest first. */
export async function pendingJoinRequests(
  db: DbExecutor,
  roomCode: string,
): Promise<PendingJoinRequest[]> {
  const rows = await db
    .select({
      id: roomJoinRequests.id,
      name: roomJoinRequests.displayName,
      guestId: roomJoinRequests.guestId,
    })
    .from(roomJoinRequests)
    .where(
      and(
        eq(roomJoinRequests.roomCode, roomCode),
        eq(roomJoinRequests.status, "pending"),
        gt(roomJoinRequests.expiresAt, sql`now()`),
      ),
    )
    .orderBy(asc(roomJoinRequests.createdAt))
    .limit(20);
  return rows.map((row) => ({ id: row.id, name: row.name, guest: row.guestId !== null }));
}

/** Accepts or declines a waiting request; false when it was already answered or lapsed. */
export async function answerJoinRequest(
  db: DbExecutor,
  {
    roomCode,
    requestId,
    deciderId,
    accept,
  }: { roomCode: string; requestId: string; deciderId: string; accept: boolean },
): Promise<boolean> {
  const answered = await db
    .update(roomJoinRequests)
    .set({
      status: accept ? "accepted" : "declined",
      decidedByUserId: deciderId,
      decidedAt: sql`now()`,
    })
    .where(
      and(
        eq(roomJoinRequests.id, requestId),
        eq(roomJoinRequests.roomCode, roomCode),
        eq(roomJoinRequests.status, "pending"),
        gt(roomJoinRequests.expiresAt, sql`now()`),
      ),
    )
    .returning({ id: roomJoinRequests.id });
  return answered.length > 0;
}
