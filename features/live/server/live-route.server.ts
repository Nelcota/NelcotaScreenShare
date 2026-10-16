import { getUserSession } from "@/features/auth/server/participant-session.server";
import { DATA_EVENT, NUDGE_EVENT, type LiveTopic } from "@/features/live/domain/live-topics";
import { liveBus, type LiveBus } from "@/features/live/server/live-bus.server";
import { createRateLimiter } from "@/server/rate-limit.server";

/** Below the 60 s idle timeouts of the proxies in front of the app. */
const KEEP_ALIVE_MS = 25_000;

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

/** The stream of one tab: nudges for this account and a comment that keeps it open. */
function liveStream(userId: string, signal: AbortSignal, bus: LiveBus, keepAliveMs: number) {
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
      const unsubscribe = bus.subscribe(userId, (topic, data) => send(nudgeMessage(topic, data)));
      const timer = setInterval(() => send(": keep-alive\n\n"), keepAliveMs);
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
) {
  const current = await getUserSession();
  if (!current) return new Response(null, { status: 401 });
  const userId = current.user.id;
  if (!limiter.hit(userId).ok) return new Response(null, { status: 429 });
  if (bus.streamCount(userId) >= MAX_STREAMS_PER_USER) {
    return new Response(null, { status: 429 });
  }
  return new Response(liveStream(userId, request.signal, bus, keepAliveMs), {
    headers: STREAM_HEADERS,
  });
}
