import { count, desc, gte } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { appErrors } from "@/server/db/schema";

const RECENT_SHOWN = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function recentErrors(db: DbExecutor, now = new Date()) {
  const [latest, lastDay] = await Promise.all([
    db
      .select({
        id: appErrors.id,
        requestId: appErrors.requestId,
        method: appErrors.method,
        path: appErrors.path,
        name: appErrors.name,
        message: appErrors.message,
        createdAt: appErrors.createdAt,
      })
      .from(appErrors)
      .orderBy(desc(appErrors.createdAt), desc(appErrors.id))
      .limit(RECENT_SHOWN),
    db
      .select({ value: count() })
      .from(appErrors)
      .where(gte(appErrors.createdAt, new Date(now.getTime() - DAY_MS))),
  ]);
  return { latest, lastDay: lastDay[0]?.value ?? 0 };
}

/** Link to the request's events in Sentry, when the issues page is configured. */
export function sentryLink(issuesUrl: string | undefined, requestId: string | null) {
  if (!issuesUrl || !requestId) return null;
  const url = new URL(issuesUrl);
  url.searchParams.set("query", `request_id:${requestId}`);
  return url.toString();
}
