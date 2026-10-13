import { DATA_EVENT, liveWindowEvent, NUDGE_EVENT } from "@/features/live/domain/live-topics";
import { createNudgeBatcher } from "@/features/live/client/nudge-batcher";
import { logBrowserWarning } from "@/lib/telemetry.client";

const LIVE_URL = "/api/eventos";
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

/**
 * Keeps one live stream open for this tab and calls `refresh` when the server says
 * something changed. Returns the cleanup.
 */
export function startLiveConnection(refresh: () => void): () => void {
  const batcher = createNudgeBatcher(refresh, BATCH_MS);
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

  function open() {
    if (source) return;
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
    next.addEventListener("error", () => {
      missed = true;
      startFallback();
      if (next.readyState === EventSource.CLOSED && source === next) source = null;
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
