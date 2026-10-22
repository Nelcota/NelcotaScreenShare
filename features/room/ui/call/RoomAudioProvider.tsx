import { AudioTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useState, type ReactNode } from "react";
import {
  DEFAULT_PARTICIPANT_AUDIO,
  normalizeAudioLevel,
  playbackVolume,
  silencedByDeafen,
  type AudioSource,
  type ParticipantAudio,
} from "@/features/room/domain/participant-audio";
import { RoomAudioContext } from "@/features/room/hooks/use-participant-audio";

/** One renderer per remote track, kept mounted while the call's page is hidden. */
function RoomAudioPlayback({
  preferences,
  deafened,
}: {
  preferences: ReadonlyMap<string, Readonly<ParticipantAudio>>;
  deafened: boolean;
}) {
  const tracks = useTracks(
    [Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown],
    { updateOnlyOn: [], onlySubscribed: true },
  ).filter((ref) => !ref.participant.isLocal && ref.publication.kind === Track.Kind.Audio);

  return (
    <div hidden>
      {tracks.map((trackRef) => {
        const identity = trackRef.participant.identity;
        const source = trackRef.source === Track.Source.ScreenShareAudio ? "sharedAudio" : "voice";
        const settings = preferences.get(identity) ?? DEFAULT_PARTICIPANT_AUDIO;
        return (
          <AudioTrack
            key={`${identity}:${trackRef.publication.trackSid}`}
            trackRef={trackRef}
            volume={playbackVolume(settings, source, deafened)}
            muted={silencedByDeafen(source, deafened)}
            data-participant={identity}
            data-source={source}
          />
        );
      })}
    </div>
  );
}

export function RoomAudioProvider({
  children,
  deafened,
}: {
  children: ReactNode;
  deafened: boolean;
}) {
  const [preferences, setPreferences] = useState<ReadonlyMap<string, Readonly<ParticipantAudio>>>(
    () => new Map(),
  );

  function update(
    identity: string,
    change: (current: Readonly<ParticipantAudio>) => ParticipantAudio,
  ) {
    setPreferences((current) => {
      const next = new Map(current);
      next.set(identity, change(current.get(identity) ?? DEFAULT_PARTICIPANT_AUDIO));
      return next;
    });
  }

  function setLevel(identity: string, source: AudioSource, level: number) {
    update(identity, (current) => ({ ...current, [source]: normalizeAudioLevel(level) }));
  }

  function toggleMute(identity: string) {
    update(identity, (current) => ({ ...current, muted: !current.muted }));
  }

  function reset(identity: string) {
    setPreferences((current) => {
      const next = new Map(current);
      next.delete(identity);
      return next;
    });
  }

  return (
    <RoomAudioContext value={{ preferences, setLevel, toggleMute, reset }}>
      {children}
      <RoomAudioPlayback preferences={preferences} deafened={deafened} />
    </RoomAudioContext>
  );
}
