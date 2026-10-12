import { and, eq, gte, isNotNull, or, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { rooms } from "@/server/db/schema";

/** Serializes deletion with webhook projection, including when a code has no current row. */
export async function lockRoomCodes(tx: DbExecutor, codes: readonly string[]) {
  for (const code of [...new Set(codes)].toSorted()) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`nelcota:room:${code}`}, 0))`,
    );
  }
}

/** Old openings must not become a new active room after their history was deleted. */
export async function isDeletedRoomEvent(
  tx: DbExecutor,
  code: string,
  at: Date,
  sid: string | undefined,
): Promise<boolean> {
  const [deleted] = await tx
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(
        eq(rooms.code, code),
        isNotNull(rooms.deletedAt),
        or(gte(rooms.deletedAt, at), sid ? eq(rooms.livekitSid, sid) : undefined),
      ),
    )
    .limit(1);
  return deleted !== undefined;
}
