import { useParticipantTracks } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useId } from "react";
import { useMediaVolumeSettable } from "@/features/room/hooks/use-media-volume-settable";
import { useParticipantAudio } from "@/features/room/hooks/use-participant-audio";
import { AudioLevel } from "./AudioLevel";
import { CardMenuItem } from "./CardMenuItem";

function plainName(participant: Participant): string {
  return participant.name || participant.identity;
}

/**
 * What I hear from this person, only for me: the voice, the sound of the screen they share,
 * silencing them and going back to the full volumes. The sliders need a page that can set the
 * volume (iPhone and iPad ignore it); silencing works everywhere.
 */
export function CardSound({ participant }: { participant: Participant }) {
  const { settings, setLevel, toggleMute, reset } = useParticipantAudio(participant.identity);
  const shares = useParticipantTracks([Track.Source.ScreenShareAudio], participant.identity);
  const settable = useMediaVolumeSettable();
  const titleId = useId();
  const hintId = useId();
  const name = plainName(participant);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1">
      <p id={titleId} className="px-2.5 pt-1 text-xs font-medium text-ink-muted">
        Som para você
      </p>
      {settable ? (
        <div className="flex flex-col gap-4 px-2.5 py-2">
          <AudioLevel
            label="Voz"
            accessibleLabel={`Voz de ${name} para você`}
            level={settings.voice}
            disabled={settings.muted}
            onChange={(level) => setLevel("voice", level)}
          />
          {shares.length > 0 ? (
            <AudioLevel
              label="Som da tela"
              accessibleLabel={`Som da tela de ${name} para você`}
              level={settings.sharedAudio}
              disabled={settings.muted}
              onChange={(level) => setLevel("sharedAudio", level)}
            />
          ) : null}
        </div>
      ) : null}
      <CardMenuItem
        icon={settings.muted ? <Volume2 /> : <VolumeX />}
        aria-pressed={settings.muted}
        aria-describedby={settings.muted ? undefined : hintId}
        onClick={toggleMute}
      >
        {settings.muted ? "Voltar a ouvir" : "Silenciar só para mim"}
      </CardMenuItem>
      {settings.muted ? null : (
        <p id={hintId} className="px-2.5 pb-1 text-xs text-ink-subtle">
          Você para de ouvir {name}. Os outros continuam ouvindo e ninguém é avisado.
        </p>
      )}
      {settable ? (
        <CardMenuItem icon={<RotateCcw />} onClick={reset}>
          Restaurar volumes
        </CardMenuItem>
      ) : null}
    </section>
  );
}
