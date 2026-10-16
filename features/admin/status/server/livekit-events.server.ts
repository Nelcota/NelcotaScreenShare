import { and, count, desc, isNotNull, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { livekitEvents } from "@/server/db/schema";
import { summarizeEventError } from "@/features/admin/status/domain/event-error";

const FAILED_EVENTS_SHOWN = 10;

interface FailedEvent {
  id: string;
  event: string;
  roomName: string | null;
  receivedAt: Date;
  /** Safe summary: never the raw error (it can carry query parameters). */
  error: string;
}

export interface LiveKitEventsSummary {
  lastEvent: { event: string; roomName: string | null; receivedAt: Date } | null;
  /** Events still waiting to be projected (maintenance retries them every 6 h). */
  failedCount: number;
  recentFailures: FailedEvent[];
}

/** What the webhook received last and which events could not be applied. */
export async function getLiveKitEventsSummary(db: DbExecutor): Promise<LiveKitEventsSummary> {
  const failed = and(isNull(livekitEvents.processedAt), isNotNull(livekitEvents.error));
  const [last, failedTotal, failures] = await Promise.all([
    db
      .select({
        event: livekitEvents.event,
        roomName: livekitEvents.roomName,
        receivedAt: livekitEvents.receivedAt,
      })
      .from(livekitEvents)
      .orderBy(desc(livekitEvents.receivedAt))
      .limit(1),
    db.select({ value: count() }).from(livekitEvents).where(failed),
    db
      .select({
        id: livekitEvents.id,
        event: livekitEvents.event,
        roomName: livekitEvents.roomName,
        receivedAt: livekitEvents.receivedAt,
        error: livekitEvents.error,
      })
      .from(livekitEvents)
      .where(failed)
      .orderBy(desc(livekitEvents.receivedAt))
      .limit(FAILED_EVENTS_SHOWN),
  ]);

  return {
    lastEvent: last[0] ?? null,
    failedCount: failedTotal[0]?.value ?? 0,
    recentFailures: failures.map((failure) => ({
      ...failure,
      error: summarizeEventError(failure.error),
    })),
  };
}
