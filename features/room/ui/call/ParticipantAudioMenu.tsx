import { useParticipantTracks } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Popover } from "radix-ui";
import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { useParticipantAudio } from "@/features/room/hooks/use-participant-audio";
import { participantName } from "@/features/room/domain/participant-label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassPopoverContent } from "@/components/GlassPopover";

function AudioLevel({
  label,
  accessibleLabel,
  level,
  disabled = false,
  onChange,
}: {
  label: string;
  accessibleLabel: string;
  level: number;
  disabled?: boolean;
  onChange: (level: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={disabled ? "text-ink-subtle" : "text-ink"}>{label}</span>
        <span className="text-ink-muted tabular-nums">{level}%</span>
      </div>
      <Slider
        value={[level]}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
        thumbProps={{ "aria-label": accessibleLabel, "aria-valuetext": `${level}%` }}
      />
    </div>
  );
}

/** Both menus for a person share the same local preferences, including while muted. */
export function ParticipantAudioMenu({
  participant,
  className,
}: {
  participant: Participant;
  className?: string;
}) {
  const name = participantName(participant);
  const audio = useParticipantAudio(participant.identity);
  const shares = useParticipantTracks([Track.Source.ScreenShareAudio], participant.identity);
  const hasSharedAudio = shares.length > 0;
  const titleId = useId();
  const hintId = useId();

  if (participant.isLocal) return null;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Áudio de ${name}`}
        className={cn(
          "glass relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          audio.settings.muted && "text-warning",
          className,
        )}
      >
        {audio.settings.muted ? (
          <VolumeX className="size-4" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4" aria-hidden="true" />
        )}
      </Popover.Trigger>
      <GlassPopoverContent
        side="left"
        sideOffset={10}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        width="sm"
        className="flex max-h-[min(var(--radix-popover-content-available-height),calc(100dvh-2rem))] flex-col gap-5 overflow-y-auto overscroll-contain p-4"
      >
        <div>
          <p id={titleId} className="truncate text-base font-medium">
            Áudio de {name}
          </p>
          <p id={hintId} className="mt-1 text-xs text-ink-subtle">
            Só muda o que você ouve.
          </p>
        </div>
        <AudioLevel
          label="Voz"
          accessibleLabel={`Voz de ${name}`}
          level={audio.settings.voice}
          onChange={(level) => audio.setLevel("voice", level)}
        />
        <AudioLevel
          label="Som compartilhado"
          accessibleLabel={`Som compartilhado de ${name}`}
          level={audio.settings.sharedAudio}
          disabled={!hasSharedAudio}
          onChange={(level) => audio.setLevel("sharedAudio", level)}
        />
        {!hasSharedAudio ? (
          <p className="-mt-2 text-xs text-ink-subtle">Sem som compartilhado agora.</p>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <button
            type="button"
            aria-pressed={audio.settings.muted}
            onClick={audio.toggleMute}
            className="rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-surface-3"
          >
            {audio.settings.muted ? "Voltar a ouvir" : "Silenciar só para mim"}
          </button>
          <Button
            type="button"
            variant="quiet"
            size="icon-lg"
            onClick={audio.reset}
            aria-label="Restaurar volumes"
            className="rounded-lg"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      </GlassPopoverContent>
    </Popover.Root>
  );
}
