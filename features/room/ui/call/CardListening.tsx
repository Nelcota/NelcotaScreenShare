import type { Participant } from "livekit-client";
import { Volume1, Volume2, VolumeOff, VolumeX } from "lucide-react";
import { useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { useMediaVolumeSettable } from "@/features/room/hooks/use-media-volume-settable";
import { useParticipantAudio } from "@/features/room/hooks/use-participant-audio";
import { CardMenuItem } from "./CardMenuItem";

function plainName(participant: Participant): string {
  return participant.name || participant.identity;
}

function VolumeIcon({ level }: { level: number }) {
  if (level === 0) return <VolumeX className="size-5" aria-hidden="true" />;
  if (level < 50) return <Volume1 className="size-5" aria-hidden="true" />;
  return <Volume2 className="size-5" aria-hidden="true" />;
}

/**
 * The voice for me, in one line: the icon silences the voice and brings back the last level,
 * keeping the screen the person shares audible. Only where the page can set the volume
 * (iPhone and iPad ignore it).
 */
export function VoiceLine({ participant }: { participant: Participant }) {
  const { settings, setLevel } = useParticipantAudio(participant.identity);
  const lastVoice = useRef(settings.voice > 0 ? settings.voice : 100);
  const settable = useMediaVolumeSettable();
  if (!settable) return null;
  const name = plainName(participant);
  const level = settings.muted ? 0 : settings.voice;
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
    <div className="flex items-center gap-2 px-1">
      <button
        type="button"
        aria-pressed={voiceSilenced}
        aria-label={voiceSilenced ? `Voltar a voz de ${name}` : `Silenciar voz de ${name}`}
        disabled={settings.muted}
        onClick={toggleVoice}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-control hover:text-ink disabled:opacity-60"
      >
        <VolumeIcon level={level} />
      </button>
      <Slider
        // The name goes on the thumb, the element screen readers announce.
        thumbProps={{ "aria-label": `Voz de ${name} para você` }}
        min={0}
        max={100}
        step={5}
        value={[settings.voice]}
        disabled={settings.muted}
        onValueChange={(values) => setLevel("voice", values[0] ?? 100)}
        className="flex-1"
      />
    </div>
  );
}

/** The room engine's mute for this person: voice and shared screen, only for me. */
export function MuteAllItem({ participant }: { participant: Participant }) {
  const { settings, toggleMute } = useParticipantAudio(participant.identity);
  return (
    <CardMenuItem icon={<VolumeOff />} aria-pressed={settings.muted} onClick={toggleMute}>
      {settings.muted ? "Voltar a ouvir" : "Silenciar tudo"}
    </CardMenuItem>
  );
}
