/** Microphone clean-up the browser does before sending the voice. All on by default. */
export interface AudioProcessing {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export const DEFAULT_AUDIO_PROCESSING: AudioProcessing = Object.freeze({
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
});

function flag(value: object, key: keyof AudioProcessing): boolean {
  const saved: unknown = Object.getOwnPropertyDescriptor(value, key)?.value;
  return typeof saved === "boolean" ? saved : DEFAULT_AUDIO_PROCESSING[key];
}

/** Reads a saved choice; anything that was not written here keeps the defaults. */
export function parseAudioProcessing(raw: string | null): AudioProcessing {
  if (!raw) return DEFAULT_AUDIO_PROCESSING;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_AUDIO_PROCESSING;
    return {
      noiseSuppression: flag(value, "noiseSuppression"),
      echoCancellation: flag(value, "echoCancellation"),
      autoGainControl: flag(value, "autoGainControl"),
    };
  } catch {
    return DEFAULT_AUDIO_PROCESSING;
  }
}
