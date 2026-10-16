import { useEffect, useEffectEvent, useState } from "react";
import { liveWindowEvent } from "@/features/live/domain/live-topics";
import { isRinging, type IncomingRing } from "@/features/ringing/domain/ring";

/** The fields the card needs, checked: the stream is still input from outside. */
function asIncomingRing(value: unknown): IncomingRing | null {
  if (typeof value !== "object" || value === null) return null;
  const ring: Partial<Record<keyof IncomingRing, unknown>> = value;
  const { id, callerId, callerName, roomCode, startedAt, expiresAt } = ring;
  if (typeof id !== "string" || typeof callerId !== "string") return null;
  if (typeof callerName !== "string" || typeof roomCode !== "string") return null;
  if (typeof startedAt !== "number" || typeof expiresAt !== "number") return null;
  return { id, callerId, callerName, roomCode, startedAt, expiresAt };
}

/** A pushed ring and the page data it arrived on top of. */
interface PushedRing {
  ring: IncomingRing;
  seenWith: unknown;
}

/**
 * The pushed ring only fills the gap until the page reloads its data: from then on the
 * loaders decide, even when a nudge saying the ring ended was lost on a dropped stream.
 */
export function shownPushedRing(pushed: PushedRing | null, loaded: unknown): IncomingRing | null {
  if (!pushed || pushed.seenWith !== loaded) return null;
  return pushed.ring;
}

/**
 * The ring that came with the live nudge, shown before the page reloads. Any later ring
 * nudge (cancelled, declined, answered) drops it, and so does the next page data.
 */
export function usePushedRing(loaded: unknown): IncomingRing | null {
  const [pushed, setPushed] = useState<PushedRing | null>(null);
  const keep = useEffectEvent((ring: IncomingRing) => setPushed({ ring, seenWith: loaded }));
  useEffect(() => {
    let expiry: number | undefined;
    const onRing = (event: Event) => {
      window.clearTimeout(expiry);
      const ring = asIncomingRing(event instanceof CustomEvent ? event.detail : null);
      if (!ring || !isRinging(ring, Date.now())) return setPushed(null);
      keep(ring);
      expiry = window.setTimeout(() => setPushed(null), ring.expiresAt - Date.now());
    };
    const name = liveWindowEvent("ring");
    window.addEventListener(name, onRing);
    return () => {
      window.clearTimeout(expiry);
      window.removeEventListener(name, onRing);
    };
  }, []);
  return shownPushedRing(pushed, loaded);
}
