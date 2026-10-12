import { createContext, use } from "react";
import {
  DEFAULT_PARTICIPANT_AUDIO,
  type AudioSource,
  type ParticipantAudio,
} from "@/features/room/domain/participant-audio";

interface RoomAudioState {
  preferences: ReadonlyMap<string, Readonly<ParticipantAudio>>;
  setLevel: (identity: string, source: AudioSource, level: number) => void;
  toggleMute: (identity: string) => void;
  reset: (identity: string) => void;
}

export const RoomAudioContext = createContext<RoomAudioState | null>(null);

/** Identity and source survive track replacement; preferences last only for this call. */
export function useParticipantAudio(identity: string) {
  const state = use(RoomAudioContext);
  if (state === null) throw new Error("useParticipantAudio must be used inside RoomAudioProvider");
  return {
    settings: state.preferences.get(identity) ?? DEFAULT_PARTICIPANT_AUDIO,
    setLevel: (source: AudioSource, level: number) => state.setLevel(identity, source, level),
    toggleMute: () => state.toggleMute(identity),
    reset: () => state.reset(identity),
  };
}
