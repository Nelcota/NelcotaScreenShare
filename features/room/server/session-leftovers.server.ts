import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomParticipations, shareSessions } from "@/server/db/schema";
import { closeShares } from "./webhook/records.server";

/**
 * A session closed for staying empty: whoever still shows as in it left without the
 * webhook saying so. Their participations and shares end at `at`, as `room_finished`
 * would have ended them, with the leave itself marked as never observed.
 */
export async function closeSessionLeftovers(tx: DbExecutor, sessionId: string, at: Date) {
  await tx
    .update(roomParticipations)
    .set({
      leftAt: sql`greatest(${roomParticipations.joinedAt}, ${at}::timestamptz)`,
      leaveReason: "unknown",
    })
    .where(
      and(
        eq(roomParticipations.sessionId, sessionId),
        isNull(roomParticipations.leftAt),
        lte(roomParticipations.joinedAt, at),
      ),
    );
  await closeShares(
    tx,
    and(
      sql`${shareSessions.participationId} in (select ${roomParticipations.id} from ${roomParticipations} where ${roomParticipations.sessionId} = ${sessionId})`,
    ),
    at,
  );
}
