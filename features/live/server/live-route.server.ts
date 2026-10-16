import {
  getUserSession,
  sessionStillValid,
} from "@/features/auth/server/participant-session.server";
import {
  DATA_EVENT,
  NUDGE_EVENT,
  SESSION_ENDED_EVENT,
  type LiveTopic,
} from "@/features/live/domain/live-topics";
import { liveBus, type LiveBus } from "@/features/live/server/live-bus.server";
import { logger } from "@/server/logger.server";
import { createRateLimiter } from "@/server/rate-limit.server";

/** Below the 60 s idle timeouts of the proxies in front of the app. */
const KEEP_ALIVE_MS = 25_000;

/**
 * How often an open stream checks its session: signing out elsewhere, a password reset or a
 * block by the admin closes it within this time.
 */
const SESSION_CHECK_MS = 60_000;

/** How long the browser waits before reconnecting after a dropped stream. */
const RETRY_MS = 5_000;

/** A person with many tabs and devices stays far below this. */
const MAX_STREAMS_PER_USER = 10;

/** Reconnects after a restart stay far below this. */
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/** No compression, no cache and no proxy buffering: each nudge must leave at once. */
const STREAM_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

const encoder = new TextEncoder();

const noop = () => {};

function nudgeMessage(topic: LiveTopic, data?: unknown) {
  if (data === undefined) return `event: ${NUDGE_EVENT}\ndata: ${topic}\n\n`;
  return `event: ${DATA_EVENT}\ndata: ${JSON.stringify({ topic, data })}\n\n`;
}

interface StreamTiming {
  keepAliveMs: number;
  sessionCheckMs: number;
}

/** Whether the session is gone. A failed check keeps the stream; the next one decides. */
async function sessionGone(sessionId: string): Promise<boolean> {
  try {
    return !(await sessionStillValid(sessionId));
  } catch (error) {
    logger.warn({ err: error }, "could not check the session of a live stream");
    return false;
  }
}

/**
 * The stream of one tab: nudges for this account, a comment that keeps it open, and a
 * periodic check that closes it once the session no longer counts.
 */
function liveStream(
  session: { userId: string; sessionId: string },
  signal: AbortSignal,
  bus: LiveBus,
  timing: StreamTiming,
) {
  let stop = noop;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The stream already closed: the cleanup below runs once.
          stop();
        }
      };
      // Gone: the tab is told why, then the stream closes.
      const checkSession = () => {
        void sessionGone(session.sessionId).then((gone) => {
          if (!gone) return;
          send(`event: ${SESSION_ENDED_EVENT}\ndata: 1\n\n`);
          onAbort();
        });
      };
      const unsubscribe = bus.subscribe(session.userId, (topic, data) => {
        // A session of this account ended: each stream checks its own at once.
        if (topic === "session") return checkSession();
        send(nudgeMessage(topic, data));
      });
      const timer = setInterval(() => send(": keep-alive\n\n"), timing.keepAliveMs);
      const check = setInterval(checkSession, timing.sessionCheckMs);
      const onAbort = () => {
        stop();
        try {
          controller.close();
        } catch {
          // Already closed by the reader.
        }
      };
      stop = () => {
        clearInterval(timer);
        clearInterval(check);
        unsubscribe();
        signal.removeEventListener("abort", onAbort);
        stop = noop;
      };
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort);
      send(`retry: ${RETRY_MS}\n\n`);
    },
    cancel() {
      stop();
    },
  });
}

/** GET /api/eventos: the live stream of a signed-in tab. */
export async function openLiveStream(
  request: Request,
  bus: LiveBus = liveBus,
  keepAliveMs: number = KEEP_ALIVE_MS,
  sessionCheckMs: number = SESSION_CHECK_MS,
) {
  const current = await getUserSession();
  if (!current) return new Response(null, { status: 401 });
  const userId = current.user.id;
  if (!limiter.hit(userId).ok) return new Response(null, { status: 429 });
  if (bus.streamCount(userId) >= MAX_STREAMS_PER_USER) {
    return new Response(null, { status: 429 });
  }
  const session = { userId, sessionId: current.session.id };
  const timing = { keepAliveMs, sessionCheckMs };
  return new Response(liveStream(session, request.signal, bus, timing), {
    headers: STREAM_HEADERS,
  });
}
