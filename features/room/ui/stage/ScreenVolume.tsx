import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Popover } from "radix-ui";
import { useRef } from "react";
import { Hint } from "@/components/Hint";
import { Slider } from "@/components/ui/slider";
import { useParticipantAudio } from "@/features/room/hooks/use-participant-audio";
import { useMediaVolumeSettable } from "@/features/room/hooks/use-media-volume-settable";
import { GlassPopoverContent } from "@/components/GlassPopover";

const STEP = 5;

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX className="size-4" aria-hidden="true" />;
  if (volume < 0.5) return <Volume1 className="size-4" aria-hidden="true" />;
  return <Volume2 className="size-4" aria-hidden="true" />;
}

/** Whether this person's screen is sending sound right now. */
function useSharesSound(identity: string): boolean {
  return useTracks([Track.Source.ScreenShareAudio], { onlySubscribed: false }).some(
    (trackRef) => trackRef.participant.identity === identity,
  );
}

/**
 * A screen without sound says so: Firefox, Safari and a shared window never send it, and
 * the viewer would otherwise look for the problem on their side.
 */
function SilentScreen() {
  return (
    <Hint text="Tela sem som">
      <span className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-subtle">
        <VolumeX className="size-4" aria-hidden="true" />
        <span className="sr-only">Tela sem som</span>
      </span>
    </Hint>
  );
}

/**
 * Volume of the shared screen's sound, only for whoever watches. The icon mutes and
 * brings back the last volume. Without sound, a quiet sign takes its place.
 */
export function ScreenSoundControl({ identity, name }: { identity: string; name: string }) {
  // The shared sound level of the room's audio engine, the same as in the person's menus.
  const { settings, setLevel } = useParticipantAudio(identity);
  const volume = settings.sharedAudio / 100;
  const lastAudible = useRef(volume > 0 ? volume : 1);
  const sharesSound = useSharesSound(identity);
  const settable = useMediaVolumeSettable();
  if (!sharesSound) return <SilentScreen />;
  if (!settable) return null;

  const percent = Math.round(volume * 100);

  function change(next: number) {
    if (next > 0) lastAudible.current = next;
    setLevel("sharedAudio", next * 100);
  }

  return (
    <Popover.Root>
      <Hint text="Volume da tela">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Volume da tela: ${percent}%`}
            className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:text-ink"
          >
            <VolumeIcon volume={volume} />
          </button>
        </Popover.Trigger>
      </Hint>
      <GlassPopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        aria-label="Volume da tela"
        className="flex w-56 items-center gap-3 px-3 py-2.5"
      >
        <button
          type="button"
          aria-label={volume === 0 ? "Voltar o som da tela" : "Silenciar a tela"}
          onClick={() => change(volume === 0 ? lastAudible.current : 0)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <VolumeIcon volume={volume} />
        </button>
        <Slider
          thumbProps={{ "aria-label": `Volume da tela de ${name}` }}
          value={[percent]}
          step={STEP}
          onValueChange={([next]) => change((next ?? percent) / 100)}
        />
        <span className="w-9 shrink-0 text-right text-xs text-ink-subtle tabular-nums">
          {percent}%
        </span>
      </GlassPopoverContent>
    </Popover.Root>
  );
}
