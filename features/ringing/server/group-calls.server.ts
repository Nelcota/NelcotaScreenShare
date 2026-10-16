import { and, desc, eq, gte } from "drizzle-orm";
import { canBeCalled } from "@/features/friends/domain/presence-status";
import { isActiveAccount, isBlockedEitherWay } from "@/features/friends/server/friendships.server";
import { shownStatuses } from "@/features/friends/server/presence-status.server";
import { memberIdsOf } from "@/features/messages/server/conversations.server";
import { roomPresence } from "@/features/room/server/presence.server";
import { inCall } from "@/features/ringing/server/ring-rules.server";
import type { DbExecutor } from "@/server/db/index.server";
import { conversationCalls, users } from "@/server/db/schema";

export async function recordGroupCall(
  db: DbExecutor,
  call: { conversationId: string; roomCode: string; startedBy: string },
) {
  await db.insert(conversationCalls).values(call);
}

/**
 * Other members who can take a ring now: no block either way, Online or Ausente, and not
 * already in the call's room.
 */
export async function ringableMembers(
  db: DbExecutor,
  conversationId: string,
  callerId: string,
  roomCode: string,
) {
  const others = (await memberIdsOf(db, conversationId)).filter((id) => id !== callerId);
  const statuses = await shownStatuses(db, others);
  const ringable: string[] = [];
  for (const id of others) {
    if (!canBeCalled(statuses.get(id) ?? "offline")) continue;
    if (!(await isActiveAccount(db, id)) || (await isBlockedEitherWay(db, callerId, id))) continue;
    if (await inCall(db, roomCode, id)) continue;
    ringable.push(id);
  }
  return ringable;
}

/**
 * The group's call while its room is live: who is in it and since when, for "Chamada em
 * andamento". Null when the latest call's room is empty.
 */
export async function liveGroupCall(db: DbExecutor, conversationId: string) {
  const [latest] = await db
    .select({ roomCode: conversationCalls.roomCode, startedAt: conversationCalls.startedAt })
    .from(conversationCalls)
    .where(eq(conversationCalls.conversationId, conversationId))
    .orderBy(desc(conversationCalls.startedAt))
    .limit(1);
  if (!latest) return null;
  const presence = await roomPresence(db, latest.roomCode);
  if (presence.online === 0) return null;
  return {
    roomCode: latest.roomCode,
    startedAt: latest.startedAt,
    people: presence.participants.map((person) => person.name),
  };
}

/** "Bruno começou uma chamada" lines from this moment on, for the timeline. */
export async function groupCallLines(db: DbExecutor, conversationId: string, since: Date) {
  return db
    .select({
      id: conversationCalls.id,
      startedAt: conversationCalls.startedAt,
      starterName: users.name,
    })
    .from(conversationCalls)
    .leftJoin(users, eq(users.id, conversationCalls.startedBy))
    .where(
      and(
        eq(conversationCalls.conversationId, conversationId),
        gte(conversationCalls.startedAt, since),
      ),
    )
    .orderBy(conversationCalls.startedAt);
}
