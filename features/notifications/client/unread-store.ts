import { useSyncExternalStore } from "react";

/** Calls and messages that arrived while the tab was in the background. */
let unread = 0;
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

export function addUnread() {
  unread += 1;
  changed();
}

export function clearUnread() {
  if (unread === 0) return;
  unread = 0;
  changed();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUnreadCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => unread,
    () => 0,
  );
}
