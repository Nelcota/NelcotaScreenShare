import { useEffect, useState } from "react";
import type { Track } from "livekit-client";
import { createPingTracker, readStreamMetrics } from "@/features/room/domain/stream-metrics";
import { usePresenterPing } from "@/features/room/hooks/use-presenter-ping";
import { logBrowserWarning } from "@/lib/telemetry.client";

interface Shown {
  fps: number | null;
  pingMs: number | null;
}

const EMPTY: Shown = { fps: null, pingMs: null };

/** Reported by the presenter's browser: viewers cannot measure someone else's connection. */
function PresenterPing({ identity, trackSid }: { identity: string; trackSid: string }) {
  const ping = usePresenterPing(identity, trackSid);
  return <span className="block">Ping de quem apresenta: {ping ?? "—"} ms</span>;
}

/**
 * Mounted only while the user chooses to inspect the focused screen.
 * `presenter`: identity of whoever shares it (absent for your own screen).
 */
export function StreamMetrics({
  track,
  trackSid,
  presenter,
}: {
  track: Track | undefined;
  trackSid: string;
  presenter: string | undefined;
}) {
  const [metrics, setMetrics] = useState<Shown>(EMPTY);
  useEffect(() => {
    if (!track) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warned = false;
    const trackPing = createPingTracker();
    function shown(report: Iterable<unknown>): Shown {
      const { fps, roundTrip } = readStreamMetrics(report);
      return { fps, pingMs: trackPing(roundTrip) };
    }
    async function sample() {
      try {
        const report = await track?.getRTCStatsReport();
        if (disposed) return;
        setMetrics(report ? shown(report.values()) : EMPTY);
      } catch (error) {
        if (disposed) return;
        setMetrics(EMPTY);
        if (!warned) logBrowserWarning("Could not read screen connection statistics", error);
        warned = true;
      }
      if (!disposed) timer = setTimeout(() => void sample(), 1000);
    }
    void sample();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [track]);
  return (
    <output
      aria-label="Estatísticas da tela"
      className="glass absolute bottom-14 left-3 rounded-xl px-3 py-2 text-xs tabular-nums"
    >
      <span className="block">
        {presenter ? "Recebendo" : "Enviando"}: {metrics.fps ?? "—"} FPS
      </span>
      <span className="block">Seu ping ao servidor: {metrics.pingMs ?? "—"} ms</span>
      {presenter ? <PresenterPing identity={presenter} trackSid={trackSid} /> : null}
    </output>
  );
}
