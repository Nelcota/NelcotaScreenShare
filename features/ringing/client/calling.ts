import { useEffect, useSyncExternalStore } from "react";
import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "@/app/root";
import { cancelCall } from "@/features/ringing/actions";
import { savePendingCall, usePendingCall } from "@/features/ringing/client/pending-call";

/** Long enough for the ring to reach the page; a lost answer never leaves "Chamando…" stuck. */
const STARTING_MS = 10_000;

/**
 * Friends this tab started calling whose ring the page does not know yet: "Chamando…" shows
 * from the click, not from the server's answer.
 */
let starting: ReadonlySet<string> = new Set();
const timers = new Map<string, number>();
const listeners = new Set<() => void>();

function publish(next: ReadonlySet<string>) {
  starting = next;
  for (const listener of listeners) listener();
}

export function markCalling(friendId: string, on: boolean): void {
  window.clearTimeout(timers.get(friendId));
  timers.delete(friendId);
  if (on === starting.has(friendId)) return;
  const next = new Set(starting);
  if (!on) {
    next.delete(friendId);
    return publish(next);
  }
  next.add(friendId);
  timers.set(
    friendId,
    window.setTimeout(() => markCalling(friendId, false), STARTING_MS),
  );
  publish(next);
}

function subscribe(changed: () => void) {
  listeners.add(changed);
  return () => listeners.delete(changed);
}

/** The ring going out to this friend, if the page knows it, and whether to show "Chamando…". */
export function useCalling(friendId: string): { ringId: string | null; calling: boolean } {
  const outgoing = useRouteLoaderData<typeof rootLoader>("root")?.ringing?.outgoing ?? [];
  const pending = usePendingCall();
  const startingNow = useSyncExternalStore(
    subscribe,
    () => starting,
    () => starting,
  );
  const ringId =
    outgoing.find((ring) => ring.calleeId === friendId && ring.state === "ringing")?.id ?? null;
  const waiting = pending?.kind === "friend" && pending.friendId === friendId;
  // The page caught up: the ring itself shows "Chamando…" from here.
  useEffect(() => {
    if (ringId) markCalling(friendId, false);
  }, [ringId, friendId]);
  return { ringId, calling: ringId !== null || waiting || startingNow.has(friendId) };
}

/** Cancelar: stops the ring, or the call still waiting for you to get into the room. */
export function cancelCalling(friendId: string, ringId: string | null): void {
  markCalling(friendId, false);
  if (ringId) {
    void cancelCall({ ringId });
    return;
  }
  savePendingCall(null);
}
