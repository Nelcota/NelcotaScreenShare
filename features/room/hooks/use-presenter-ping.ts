import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  createReceiveThrottle,
  decodeMessage,
  encodeMessage,
  screenStatsSchema,
  TOPICS,
} from "@/features/room/domain/data-channel";
import { createPingTracker, readStreamMetrics } from "@/features/room/domain/stream-metrics";
import { useTimeouts } from "@/lib/hooks/use-timeouts";
import { logBrowserWarning } from "@/lib/telemetry.client";

const SEND_INTERVAL_MS = 2000;
/** Without a fresh number (presenter gone, connection lost) the value goes back to unknown. */
const STALE_AFTER_MS = 3 * SEND_INTERVAL_MS;

/**
 * While this person shares a screen, their own round trip to the media server goes to
 * the others every 2 s (a few bytes, lossy): viewers only measure their own connection.
 */
export function useBroadcastPresenterPing() {
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(Track.Source.ScreenShare);
  const track = publication?.track;
  const trackSid = publication?.trackSid;
  const { send } = useDataChannel(TOPICS.screenStats);
  const sendStats = useEffectEvent((payload: Uint8Array) => send(payload, { reliable: false }));

  useEffect(() => {
    if (!track || !trackSid) return;
    let disposed = false;
    let warned = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trackPing = createPingTracker();
    async function report(screen: Track, sid: string) {
      try {
        const stats = await screen.getRTCStatsReport();
        const pingMs = trackPing(stats ? readStreamMetrics(stats.values()).roundTrip : null);
        if (!disposed && pingMs !== null) await sendStats(encodeMessage({ trackSid: sid, pingMs }));
      } catch (error) {
        if (!warned) logBrowserWarning("Could not share the presenter's ping", error);
        warned = true;
      }
      if (!disposed) timer = setTimeout(() => void report(screen, sid), SEND_INTERVAL_MS);
    }
    void report(track, trackSid);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [track, trackSid]);
}

/** The presenter's last reported ping for this screen, or null when unknown or stale. */
export function usePresenterPing(presenterIdentity: string, trackSid: string): number | null {
  const [ping, setPing] = useState<number | null>(null);
  const latest = useRef(0);
  const later = useTimeouts();
  const [accept] = useState(() => createReceiveThrottle(SEND_INTERVAL_MS / 2));

  useDataChannel(TOPICS.screenStats, (message) => {
    // Only the person sharing this screen may report its ping.
    const sender = message.from?.identity;
    if (sender !== presenterIdentity || !accept(sender)) return;
    const stats = decodeMessage(message.payload, screenStatsSchema);
    if (!stats || stats.trackSid !== trackSid) return;
    const received = ++latest.current;
    setPing(stats.pingMs);
    later(() => {
      if (latest.current === received) setPing(null);
    }, STALE_AFTER_MS);
  });

  return ping;
}
