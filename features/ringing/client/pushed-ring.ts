import { useEffect, useState } from "react";
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

/**
 * The ring that came with the live nudge, shown before the page reloads. Any later ring
 * nudge (cancelled, declined, answered) drops it, and the loaders take over again.
 */
export function usePushedRing(): IncomingRing | null {
  const [pushed, setPushed] = useState<IncomingRing | null>(null);
  useEffect(() => {
    let expiry: number | undefined;
    const onRing = (event: Event) => {
      window.clearTimeout(expiry);
      const ring = asIncomingRing(event instanceof CustomEvent ? event.detail : null);
      if (!ring || !isRinging(ring, Date.now())) return setPushed(null);
      setPushed(ring);
      expiry = window.setTimeout(() => setPushed(null), ring.expiresAt - Date.now());
    };
    const name = liveWindowEvent("ring");
    window.addEventListener(name, onRing);
    return () => {
      window.clearTimeout(expiry);
      window.removeEventListener(name, onRing);
    };
  }, []);
  return pushed;
}
