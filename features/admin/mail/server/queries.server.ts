import { count, desc, gte, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { mailDeliveries } from "@/server/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SHOWN = 50;

export async function listRecentDeliveries(db: DbExecutor) {
  return db
    .select({
      id: mailDeliveries.id,
      subject: mailDeliveries.subject,
      recipientDomain: mailDeliveries.recipientDomain,
      provider: mailDeliveries.provider,
      status: mailDeliveries.status,
      reason: mailDeliveries.reason,
      attempts: mailDeliveries.attempts,
      createdAt: mailDeliveries.createdAt,
    })
    .from(mailDeliveries)
    .orderBy(desc(mailDeliveries.createdAt), desc(mailDeliveries.id))
    .limit(RECENT_SHOWN);
}

export type DeliveryRow = Awaited<ReturnType<typeof listRecentDeliveries>>[number];

/** Accepted and not accepted in the last 24 hours. */
export async function deliveryCounts(db: DbExecutor, now = new Date()) {
  const [row] = await db
    .select({
      accepted: count(sql`case when ${mailDeliveries.status} = 'accepted' then 1 end`),
      refused: count(sql`case when ${mailDeliveries.status} <> 'accepted' then 1 end`),
    })
    .from(mailDeliveries)
    .where(gte(mailDeliveries.createdAt, new Date(now.getTime() - DAY_MS)));
  return { accepted: row?.accepted ?? 0, refused: row?.refused ?? 0 };
}
