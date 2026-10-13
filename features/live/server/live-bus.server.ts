import type { LiveTopic } from "@/features/live/domain/live-topics";

type Listener = (topic: LiveTopic) => void;

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
  function notify(userIds: Iterable<string>, topic: LiveTopic): void {
    for (const userId of new Set(userIds)) {
      for (const listener of listeners.get(userId) ?? []) listener(topic);
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
