import { getUserSession } from "@/features/auth/server/participant-session.server";
import { announcePresence } from "@/features/friends/server/friend-nudges.server";
import { markOnline, onWentOffline } from "@/features/friends/server/online-presence.server";
import { getDb } from "@/server/db/index.server";
import { logger } from "@/server/logger.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { createRateLimiter } from "@/server/rate-limit.server";

/** A few tabs beating every 45 seconds stay far below this. */
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** Friends' lists reload when someone comes online or goes offline. */
async function announce(userId: string) {
  try {
    await announcePresence(getDb(), userId);
  } catch (error) {
    logger.warn({ err: error }, "presence announce failed");
  }
}

// Registered before the first beat starts the sweep.
onWentOffline((userIds) => {
  for (const userId of userIds) void announce(userId);
});

/** The beat of an open tab: the signed-in person counts as online. */
export async function recordPresence(request: Request) {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const current = await getUserSession();
  if (!current) return new Response(null, { status: 401 });
  if (!limiter.hit(current.user.id).ok) return new Response(null, { status: 429 });
  if (markOnline(current.user.id)) await announce(current.user.id);
  return new Response(null, { status: 204 });
}
