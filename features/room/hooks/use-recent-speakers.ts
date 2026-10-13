import { useParticipants, useSpeakingParticipants } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import {
  nextExpiry,
  noteSpeakers,
  speakerFaces,
  type LastSpoke,
  type SpeakerFaces,
} from "@/features/room/domain/recent-speakers";

/** The clock, read only in effects and timers. */
function clockNow(): number {
  return Date.now();
}

/**
 * Who the minimized card shows, following the call: the speakers of the last moments, held a
 * little after they stop so a short pause does not make them blink out.
 */
export function useRecentSpeakers(): SpeakerFaces {
  const speaking = useSpeakingParticipants().map((participant) => participant.identity);
  const present = useParticipants().map((participant) => participant.identity);
  const [last, setLast] = useState<LastSpoke>(() => new Map());
  const [now, setNow] = useState(0);
  const before = useRef<string[]>([]);
  const speakingKey = speaking.join(",");

  // Whoever starts or stops speaking is noted now: a stop starts their hold.
  useEffect(() => {
    const at = clockNow();
    const changed = [...new Set([...before.current, ...speakingKey.split(",")])].filter(Boolean);
    before.current = speakingKey ? speakingKey.split(",") : [];
    setLast((current) => noteSpeakers(current, changed, at));
    setNow(at);
  }, [speakingKey, before]);

  // Redraws when the next held face is due to leave.
  useEffect(() => {
    const wait = nextExpiry(last, before.current, now);
    if (wait === undefined) return;
    const timer = window.setTimeout(() => setNow(clockNow()), wait + 10);
    return () => window.clearTimeout(timer);
  }, [last, now, before]);

  return speakerFaces(last, speaking, present, now);
}
