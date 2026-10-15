import {
  DATA_EVENT,
  liveWindowEvent,
  NUDGE_EVENT,
  SESSION_ENDED_EVENT,
} from "@/features/live/domain/live-topics";
import { createNudgeBatcher } from "@/features/live/client/nudge-batcher";
import { logBrowserWarning } from "@/lib/telemetry.client";

const LIVE_URL = "/api/eventos";
/** Better Auth's own: `null` once the session of this browser is gone. */
const SESSION_URL = "/api/auth/get-session";
const BATCH_MS = 300;
/** While the stream is down, the page still reloads its data this often. */
const FALLBACK_MS = 60_000;

const isVisible = () => document.visibilityState === "visible";

/** `{ topic, data }` from the server; null when it cannot be read. */
function parseDataMessage(raw: unknown): { topic: string; data: unknown } | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!("topic" in parsed) || typeof parsed.topic !== "string") return null;
    return { topic: parsed.topic, data: "data" in parsed ? parsed.data : null };
  } catch (error) {
    logBrowserWarning("Could not read a live message", error);
    return null;
  }
}

/** Lets features react to a topic at once, before the loaders reload. */
function announce(topic: unknown, data: unknown) {
  if (typeof topic !== "string") return;
  window.dispatchEvent(new CustomEvent(liveWindowEvent(topic), { detail: data }));
}

/** The stream was refused (it gives a 401 once the session is gone): ask the session itself. */
async function sessionIsGone(): Promise<boolean> {
  try {
    const response = await fetch(SESSION_URL, { credentials: "same-origin" });
    if (!response.ok) return false;
    return (await response.json()) === null;
  } catch {
    // The server is away (a restart): nothing to conclude yet.
    return false;
  }
}

/**
 * Keeps one live stream open for this tab and calls `refresh` when the server says
 * something changed, or `onSessionEnded` once this browser's session is gone (ended in
 * another one, a password reset): the page must not quietly turn into a visitor's.
 * Returns the cleanup.
 */
export function startLiveConnection(
  refresh: () => void,
  onSessionEnded: () => void = () => {},
): () => void {
  const batcher = createNudgeBatcher(refresh, BATCH_MS);
  let ended = false;
  let source: EventSource | null = null;
  // Something may have changed while the stream was down: catch up on the next open.
  let missed = false;
  let fallback: ReturnType<typeof setInterval> | undefined;

  function stopFallback() {
    clearInterval(fallback);
    fallback = undefined;
  }

  function startFallback() {
    if (fallback !== undefined) return;
    fallback = setInterval(() => {
      batcher.nudge();
      // The browser gives up after an error status; try again from here.
      if (!source) open();
    }, FALLBACK_MS);
  }

  function close() {
    if (!source) return;
    source.close();
    source = null;
    missed = true;
  }

  function endSession() {
    if (ended) return;
    ended = true;
    stopFallback();
    batcher.cancel();
    source?.close();
    source = null;
    onSessionEnded();
  }

  function open() {
    if (source || ended) return;
    const next = new EventSource(LIVE_URL);
    next.addEventListener(NUDGE_EVENT, (event) => {
      announce(event.data, null);
      // A ring that ends ("Bia recusou") or starts shows without the batch delay.
      if (event.data === "ring") return batcher.now();
      batcher.nudge();
    });
    next.addEventListener(DATA_EVENT, (event) => {
      const message = parseDataMessage(event.data);
      if (message) announce(message.topic, message.data);
      batcher.nudge();
    });
    next.addEventListener("open", () => {
      stopFallback();
      if (missed) batcher.nudge();
      missed = false;
    });
    next.addEventListener(SESSION_ENDED_EVENT, endSession);
    next.addEventListener("error", () => {
      missed = true;
      if (next.readyState !== EventSource.CLOSED) return startFallback();
      if (source === next) source = null;
      // Refused for good: if the session is gone, say so before any reload shows a visitor.
      void sessionIsGone().then((gone) => {
        if (gone) return endSession();
        startFallback();
      });
    });
    source = next;
  }

  function onVisibility() {
    if (isVisible()) open();
  }

  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) open();
  }

  open();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", close);
  window.addEventListener("pageshow", onPageShow);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", close);
    window.removeEventListener("pageshow", onPageShow);
    stopFallback();
    batcher.cancel();
    source?.close();
    source = null;
  };
}
