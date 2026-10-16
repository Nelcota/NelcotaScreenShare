import { useEffect, useSyncExternalStore } from "react";
import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "@/app/root";
import { callFriend, cancelCall } from "@/features/ringing/actions";
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

function markCalling(friendId: string, on: boolean): void {
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

/** Retained until the request settles, even when the initiating component unmounts. */
interface CallAttempt {
  cancelled: boolean;
  ringId: string | null;
}
const attempts = new Map<string, CallAttempt>();

function finishAttempt(friendId: string, attempt: CallAttempt) {
  if (attempts.get(friendId) !== attempt) return;
  if (!attempt.ringId) markCalling(friendId, false);
  if (attempt.cancelled || !attempt.ringId) attempts.delete(friendId);
}

/** A cancelled request must cancel its eventual server ring and skip room creation. */
export async function ringFriend(
  input: Parameters<typeof callFriend>[0],
  needsRoom?: (active: () => boolean) => Promise<void>,
) {
  const previous = attempts.get(input.friendId);
  if (previous) previous.cancelled = true;
  const attempt: CallAttempt = { cancelled: false, ringId: null };
  attempts.set(input.friendId, attempt);
  markCalling(input.friendId, true);
  try {
    const result = await callFriend(input);
    attempt.ringId = result.data?.ringId ?? null;
    if (attempt.cancelled) {
      if (result.data?.ringId) await cancelCall({ ringId: result.data.ringId });
      return null;
    }
    if (result.data?.needsRoom && needsRoom) await needsRoom(() => !attempt.cancelled);
    if (attempt.cancelled) return null;
    return result;
  } finally {
    finishAttempt(input.friendId, attempt);
  }
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
    if (!ringId) return;
    markCalling(friendId, false);
    if (attempts.get(friendId)?.ringId === ringId) attempts.delete(friendId);
  }, [ringId, friendId]);
  return { ringId, calling: ringId !== null || waiting || startingNow.has(friendId) };
}

/** Cancelar: stops the ring, or the call still waiting for you to get into the room. */
export function cancelCalling(friendId: string, ringId: string | null): void {
  const attempt = attempts.get(friendId);
  if (attempt) attempt.cancelled = true;
  attempts.delete(friendId);
  markCalling(friendId, false);
  const knownRingId = ringId ?? attempt?.ringId;
  if (knownRingId) {
    void cancelCall({ ringId: knownRingId });
    return;
  }
  savePendingCall(null);
}
