import type { Participant } from "livekit-client";
import { MonitorPlay, MonitorUp } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { useScreenPreview } from "@/features/room/hooks/use-screen-preview";
import { useScreenWatch } from "@/features/room/hooks/use-screen-watch";
import { HostBadge } from "./HostBadge";
import { ParticipantAudioMenu } from "./ParticipantAudioMenu";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ParticipantCard } from "./ParticipantCard";
import { SoundBadge } from "./SoundBadge";

/** A screen-like pattern for before the first frame (or a browser that cannot send one). */
function NeutralScreen() {
  return (
    <div aria-hidden="true" className="absolute -inset-3 scale-105 blur-md">
      <div className="absolute inset-0 bg-brand/10" />
      <div className="absolute top-[12%] left-[8%] h-[10%] w-[46%] rounded-lg bg-brand/35" />
      <div className="absolute top-[30%] left-[8%] h-[5%] w-[62%] rounded-md bg-ink/12" />
      <div className="absolute top-[40%] left-[8%] h-[5%] w-[55%] rounded-md bg-ink/12" />
      <div className="absolute top-[56%] left-[8%] h-[30%] w-[38%] rounded-xl bg-brand/25" />
      <div className="absolute top-[56%] left-[52%] h-[30%] w-[38%] rounded-xl bg-warning/25" />
    </div>
  );
}

/** The frame the sharer sent, blurred again here so text never reads. */
function ScreenPreview({ image }: { image: string }) {
  return (
    <img
      src={image}
      alt=""
      aria-hidden="true"
      className="absolute -inset-4 size-[calc(100%+2rem)] max-w-none scale-110 object-cover blur-lg"
    />
  );
}

interface ShareTileCardProps {
  scope: RefObject<HTMLDivElement | null>;
  participant: Participant;
  roomCode: string;
  /** The screen waiting for "Assistir". */
  trackSid: string;
  name: string;
  muted: boolean;
  deafened: boolean;
  isSpeaking: boolean;
}

/**
 * The sharer's tile while nobody here watches their screen: a blurred glimpse of it, with
 * "Assistir" in the middle and the person in the same corner as on every card. Assistir takes the
 * screen to the stage, as before.
 */
export function ShareTileCard({
  scope,
  participant,
  roomCode,
  trackSid,
  name,
  muted,
  deafened,
  isSpeaking,
}: ShareTileCardProps) {
  const { watch, takeFocus } = useScreenWatch();
  const image = useScreenPreview(participant.identity, trackSid);
  return (
    <div
      key="share"
      ref={scope}
      data-flip-id={`tile-${participant.identity}`}
      className="relative isolate aspect-video w-full shrink-0 rounded-3xl"
    >
      <div
        data-glow
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 -z-10 rounded-[1.65rem] bg-brand/30 opacity-0 blur-md"
      />
      <div className="relative flex size-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-tile-line bg-tile shadow-soft">
        {image ? <ScreenPreview image={image} /> : <NeutralScreen />}
        <div aria-hidden="true" className="absolute inset-0 bg-canvas/40" />
        <div
          data-ring
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-3xl opacity-0 ring-3 ring-brand-soft ring-inset"
        />

        <ParticipantAudioMenu participant={participant} className="absolute top-3 right-3 z-20" />

        <div className="relative z-20 flex flex-col items-center">
          <Button
            size="lg"
            ref={(button) => {
              if (button && takeFocus(trackSid, "invite")) button.focus();
            }}
            aria-label={`Assistir à tela de ${name}`}
            onClick={() => watch(trackSid)}
          >
            <MonitorPlay aria-hidden="true" />
            Assistir
          </Button>
          <span className="sr-only">{name} está compartilhando a tela</span>
        </div>

        {/* The same corners as every other card: the person below left, their sound below right. */}
        <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2">
          <span className="glass inline-flex min-w-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-medium">
            <ParticipantCard participant={participant} roomCode={roomCode}>
              <ParticipantAvatar
                participant={participant}
                roomCode={roomCode}
                className="size-6 bg-brand/15 text-[0.625rem] font-medium text-brand-soft"
              />
            </ParticipantCard>
            <HostBadge identity={participant.identity} />
            <span className="truncate">{name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-ink">
              <MonitorUp className="size-4" aria-hidden="true" />
            </span>
            <SoundBadge deafened={deafened} muted={muted} variant="large" />
          </span>
        </div>
        {isSpeaking ? <span className="sr-only">{name} está falando</span> : null}
      </div>
    </div>
  );
}
