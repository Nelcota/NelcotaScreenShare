import { asc, count, desc, gt } from "drizzle-orm";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { proInterests } from "@/server/db/schema";

const LATEST_SHOWN = 100;
const EXPORT_BATCH = 1000;

/** Everyone on the Pro launch list: how many and the latest sign-ups. */
export async function getWaitlist(db: DbExecutor) {
  const [total, latest] = await Promise.all([
    db.select({ value: count() }).from(proInterests),
    db
      .select({ id: proInterests.id, email: proInterests.email, createdAt: proInterests.createdAt })
      .from(proInterests)
      .orderBy(desc(proInterests.createdAt), desc(proInterests.id))
      .limit(LATEST_SHOWN),
  ]);
  return { total: total[0]?.value ?? 0, latest };
}

/** The whole list, oldest first, in batches (ids are UUID v7, so they follow sign-up order). */
export async function* iterateWaitlist(db: Database) {
  let after: string | undefined;
  while (true) {
    const batch = await db
      .select({ id: proInterests.id, email: proInterests.email, createdAt: proInterests.createdAt })
      .from(proInterests)
      .where(after ? gt(proInterests.id, after) : undefined)
      .orderBy(asc(proInterests.id))
      .limit(EXPORT_BATCH);
    yield* batch;
    const last = batch.at(-1);
    if (!last || batch.length < EXPORT_BATCH) return;
    after = last.id;
  }
}
