import type { Participant } from "livekit-client";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { useMediaVolumeSettable } from "@/features/room/hooks/use-media-volume-settable";
import { useParticipantAudio } from "@/features/room/hooks/use-participant-audio";

function plainName(participant: Participant): string {
  return participant.name || participant.identity;
}

function VolumeIcon({ volume, silenced }: { volume: number; silenced: boolean }) {
  if (silenced || volume === 0) return <VolumeX className="size-5" aria-hidden="true" />;
  if (volume < 0.5) return <Volume1 className="size-5" aria-hidden="true" />;
  return <Volume2 className="size-5" aria-hidden="true" />;
}

/** The voice level for one person, for browsers that let the page set it. */
function VoiceSlider({ participant }: { participant: Participant }) {
  const { settings, setLevel } = useParticipantAudio(participant.identity);
  const silenced = settings.muted || settings.voice === 0;
  return (
    <>
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>Voz para você</span>
        <span className="tabular-nums">{silenced ? "Silenciada" : `${settings.voice}%`}</span>
      </div>
      <div className="flex items-center gap-3 text-ink-muted">
        <VolumeIcon volume={settings.voice / 100} silenced={silenced} />
        <Slider
          // The name goes on the thumb, the element screen readers announce.
          thumbProps={{ "aria-label": `Voz de ${plainName(participant)} para você` }}
          min={0}
          max={100}
          step={5}
          value={[settings.voice]}
          disabled={settings.muted}
          onValueChange={(values) => setLevel("voice", values[0] ?? 100)}
          className="flex-1"
        />
      </div>
    </>
  );
}

const QUIET_BUTTON =
  "flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 text-base font-medium transition-colors hover:bg-surface-3";

/**
 * Only for me: nobody else hears the change. "Silenciar voz" quiets the voice and keeps the
 * screen they share audible; "Silenciar tudo" is the room engine's mute, voice and screen.
 */
export function ListeningControls({ participant }: { participant: Participant }) {
  const { settings, setLevel, toggleMute } = useParticipantAudio(participant.identity);
  const lastVoice = useRef(settings.voice > 0 ? settings.voice : 100);
  // iPhone and iPad ignore volume set by the page: only the mute is offered there.
  const settable = useMediaVolumeSettable();
  const voiceSilenced = settings.voice === 0;

  function toggleVoice() {
    if (!voiceSilenced) {
      lastVoice.current = settings.voice;
      setLevel("voice", 0);
      return;
    }
    setLevel("voice", lastVoice.current);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      {settable ? <VoiceSlider participant={participant} /> : null}
      {settable ? (
        <button
          type="button"
          aria-pressed={voiceSilenced}
          disabled={settings.muted}
          onClick={toggleVoice}
          className={QUIET_BUTTON}
        >
          {voiceSilenced ? "Voltar a voz" : "Silenciar voz"}
        </button>
      ) : null}
      <button
        type="button"
        aria-pressed={settings.muted}
        onClick={toggleMute}
        className={QUIET_BUTTON}
      >
        {settings.muted ? "Voltar a ouvir" : "Silenciar tudo"}
      </button>
    </div>
  );
}
