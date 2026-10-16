import { eq, inArray } from "drizzle-orm";
import {
  DEFAULT_STATUS,
  shownStatus,
  type PresenceStatus,
  type ShownStatus,
} from "@/features/friends/domain/presence-status";
import { isOnline } from "@/features/friends/server/online-presence.server";
import type { DbExecutor } from "@/server/db/index.server";
import { userPresence } from "@/server/db/schema";

/** The status the person picked; without a choice yet, Online. */
export async function chosenStatus(db: DbExecutor, userId: string): Promise<PresenceStatus> {
  const [row] = await db
    .select({ status: userPresence.status })
    .from(userPresence)
    .where(eq(userPresence.userId, userId));
  return row?.status ?? DEFAULT_STATUS;
}

export async function saveStatus(db: DbExecutor, userId: string, status: PresenceStatus) {
  await db
    .insert(userPresence)
    .values({ userId, status })
    .onConflictDoUpdate({ target: userPresence.userId, set: { status, updatedAt: new Date() } });
}

/** What each of these people shows to friends right now: their choice while connected. */
export async function shownStatuses(
  db: DbExecutor,
  userIds: string[],
): Promise<Map<string, ShownStatus>> {
  const rows =
    userIds.length === 0
      ? []
      : await db
          .select({ userId: userPresence.userId, status: userPresence.status })
          .from(userPresence)
          .where(inArray(userPresence.userId, userIds));
  const chosen = new Map(rows.map((row) => [row.userId, row.status]));
  return new Map(
    userIds.map((userId) => [
      userId,
      shownStatus(chosen.get(userId) ?? DEFAULT_STATUS, isOnline(userId)),
    ]),
  );
}
