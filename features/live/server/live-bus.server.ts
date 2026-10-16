import type { LiveTopic } from "@/features/live/domain/live-topics";

/** The topic, and for some topics the data the page shows at once (a ring for the callee). */
type Listener = (topic: LiveTopic, data?: unknown) => void;

/** Plain nudges reach the listener with the topic alone. */
function tell(listener: Listener, topic: LiveTopic, data: unknown) {
  if (data === undefined) return listener(topic);
  listener(topic, data);
}

/**
 * Who has a live stream open, by account. Kept in memory, like presence and the rate limits:
 * enough for a single instance (docs/development.md).
 */
export function createLiveBus() {
  const listeners = new Map<string, Set<Listener>>();

  function subscribe(userId: string, listener: Listener): () => void {
    const own = listeners.get(userId) ?? new Set<Listener>();
    own.add(listener);
    listeners.set(userId, own);
    return () => {
      own.delete(listener);
      if (own.size === 0 && listeners.get(userId) === own) listeners.delete(userId);
    };
  }

  /** Nudges only these accounts; one closed stream never stops the others. */
  function notify(userIds: Iterable<string>, topic: LiveTopic, data?: unknown): void {
    for (const userId of new Set(userIds)) {
      for (const listener of listeners.get(userId) ?? []) tell(listener, topic, data);
    }
  }

  function streamCount(userId: string): number {
    return listeners.get(userId)?.size ?? 0;
  }

  return { subscribe, notify, streamCount };
}

export type LiveBus = ReturnType<typeof createLiveBus>;

export const liveBus = createLiveBus();

/** Tells the open tabs of these accounts that something they see has changed. */
export function notifyUsers(userIds: Iterable<string>, topic: LiveTopic): void {
  liveBus.notify(userIds, topic);
}

/**
 * A nudge that also carries what changed, for what must show before the loaders reload
 * (the ring card). Only data the account may already see goes here.
 */
export function notifyUserWithData(userId: string, topic: LiveTopic, data: unknown): void {
  liveBus.notify([userId], topic, data);
}
