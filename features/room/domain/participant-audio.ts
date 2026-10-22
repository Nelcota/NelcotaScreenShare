export type AudioSource = "voice" | "sharedAudio";

export interface ParticipantAudio {
  voice: number;
  sharedAudio: number;
  muted: boolean;
}

export const DEFAULT_PARTICIPANT_AUDIO: Readonly<ParticipantAudio> = {
  voice: 100,
  sharedAudio: 100,
  muted: false,
};

/** Levels are local playback percentages, without amplification above the original. */
export function normalizeAudioLevel(level: number): number {
  if (!Number.isFinite(level)) return 100;
  return Math.max(0, Math.min(100, level));
}

/** "Sem som" silences only the voices: the screen being watched keeps its sound. */
export function silencedByDeafen(source: AudioSource, deafened: boolean): boolean {
  return deafened && source === "voice";
}

/** Global deafening and local mute preserve the saved levels for when hearing resumes. */
export function playbackVolume(
  settings: Readonly<ParticipantAudio>,
  source: AudioSource,
  deafened: boolean,
): number {
  if (settings.muted) return 0;
  if (silencedByDeafen(source, deafened)) return 0;
  return normalizeAudioLevel(settings[source]) / 100;
}
