import { useEffect, useSyncExternalStore } from "react";

/**
 * The room this tab's call is connected to, as LiveKit reports it. A waiting Chamar rings
 * on this signal, without waiting for the webhook to record the participation.
 */
let connectedRoom: string | null = null;
const listeners = new Set<() => void>();

function announce(room: string | null) {
  if (connectedRoom === room) return;
  connectedRoom = room;
  for (const listener of listeners) listener();
}

function subscribe(changed: () => void) {
  listeners.add(changed);
  return () => listeners.delete(changed);
}

/** Called by the room once its call reaches Connected; cleared when the room goes away. */
export function useAnnounceCallConnected(room: string, connected: boolean): void {
  useEffect(() => {
    if (!connected) return;
    announce(room);
    return () => announce(null);
  }, [room, connected]);
}

export function useConnectedCallRoom(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => connectedRoom,
    () => null,
  );
}
