import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { listCallRemovals, type CallRemoval } from "@/features/room/server/call-removals.server";
import type { DbExecutor } from "@/server/db/index.server";
import { roomParticipations, users } from "@/server/db/schema";
import { logger } from "@/server/logger.server";

/** Who did it: a member of the room by name, or the admin panel (the admin is in the audit). */
export type RemovedBy = { kind: "member"; name: string } | { kind: "panel" } | null;

export interface RemovedPerson {
  identity: string;
  userId: string | null;
  name: string;
  removedAt: Date;
  removedBy: RemovedBy;
}

type ListRemovals = (db: DbExecutor, roomCode: string) => Promise<CallRemoval[]>;

/** The name used in this room: the one typed for the call, else the account's. */
async function namesInRoom(db: DbExecutor, roomId: string, identities: string[]) {
  const rows = await db
    .select({
      identity: roomParticipations.livekitIdentity,
      name: roomParticipations.displayName,
    })
    .from(roomParticipations)
    .where(
      and(
        eq(roomParticipations.roomId, roomId),
        inArray(roomParticipations.livekitIdentity, identities),
      ),
    )
    .orderBy(desc(roomParticipations.joinedAt));
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.name && !names.has(row.identity)) names.set(row.identity, row.name);
  }
  return names;
}

async function accountNames(db: DbExecutor, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(inArray(users.id, ids), isNull(users.deletedAt)));
  return new Map(rows.map((row) => [row.id, row.name]));
}

function removedBy(removal: CallRemoval, accounts: ReadonlyMap<string, string>): RemovedBy {
  if (removal.byAdminId) return { kind: "panel" };
  const name = removal.byUserId ? accounts.get(removal.byUserId) : undefined;
  if (!name) return null;
  return { kind: "member", name };
}

async function withNames(
  db: DbExecutor,
  roomId: string,
  removals: CallRemoval[],
): Promise<RemovedPerson[]> {
  if (removals.length === 0) return [];
  const accountIds = removals.flatMap((removal) =>
    [removal.userId, removal.byUserId].filter((id): id is string => id !== null),
  );
  const [inRoom, accounts] = await Promise.all([
    namesInRoom(
      db,
      roomId,
      removals.map((removal) => removal.identity),
    ),
    accountNames(db, [...new Set(accountIds)]),
  ]);
  return removals.map((removal) => ({
    identity: removal.identity,
    userId: removal.userId,
    name:
      inRoom.get(removal.identity) ??
      (removal.userId ? accounts.get(removal.userId) : undefined) ??
      "Convidado",
    removedAt: removal.removedAt,
    removedBy: removedBy(removal, accounts),
  }));
}

/**
 * Who was banned from the call happening now, with names, newest first. `null` when
 * LiveKit does not answer (with host controls off the current call comes from it).
 */
export async function removedFromCall(
  db: DbExecutor,
  room: { id: string; code: string },
  list: ListRemovals = listCallRemovals,
): Promise<RemovedPerson[] | null> {
  const removals = await currentRemovals(db, room.code, list);
  if (!removals) return null;
  return withNames(db, room.id, removals);
}

async function currentRemovals(
  db: DbExecutor,
  roomCode: string,
  list: ListRemovals,
): Promise<CallRemoval[] | null> {
  try {
    return await list(db, roomCode);
  } catch (error) {
    logger.warn(
      { failure: error instanceof Error ? error.name : "unknown" },
      "admin room: call removals unavailable",
    );
    return null;
  }
}
