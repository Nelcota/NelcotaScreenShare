import type { TrackReference } from "@livekit/components-react";
import { MonitorPlay, MonitorUp } from "lucide-react";
import { participantLabel } from "@/features/room/domain/participant-label";
import { useScreenWatch } from "@/features/room/hooks/use-screen-watch";
import { cn } from "@/lib/utils";

/** Switches between the shared screens, and offers the ones not watched yet. */
export function SharePicker({
  shares,
  invites,
  focusedSid,
  onFocus,
}: {
  shares: TrackReference[];
  invites: TrackReference[];
  focusedSid: string;
  onFocus: (trackSid: string) => void;
}) {
  const { watch } = useScreenWatch();
  return (
    <fieldset
      // Plain toggle buttons: a tablist promises arrow keys and a tabpanel.
      aria-label="Escolher a tela compartilhada"
      className="glass absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] min-w-0 -translate-x-1/2 gap-1 overflow-x-auto rounded-xl p-1"
    >
      {shares.map((share) => {
        const trackSid = share.publication.trackSid;
        const active = trackSid === focusedSid;
        return (
          <button
            key={trackSid}
            type="button"
            aria-pressed={active}
            onClick={() => onFocus(trackSid)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-brand text-brand-ink"
                : "text-ink-muted hover:bg-surface-3 hover:text-ink",
            )}
          >
            <MonitorUp className="size-3.5" aria-hidden="true" />
            {participantLabel(share.participant)}
          </button>
        );
      })}
      {invites.map((invite) => {
        const name = participantLabel(invite.participant);
        return (
          <button
            key={invite.publication.trackSid}
            type="button"
            aria-label={`Assistir à tela de ${name}`}
            onClick={() => watch(invite.publication.trackSid)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <MonitorPlay className="size-3.5" aria-hidden="true" />
            {name}
          </button>
        );
      })}
    </fieldset>
  );
}
