import { useMemo, useSyncExternalStore } from "react";
import { MEDIA_SETTINGS_EVENT, savedAudioProcessing } from "@/features/room/client/saved-media";
import {
  DEFAULT_AUDIO_PROCESSING,
  parseAudioProcessing,
  type AudioProcessing,
} from "@/features/room/domain/audio-processing";

function subscribe(changed: () => void) {
  window.addEventListener(MEDIA_SETTINGS_EVENT, changed);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(MEDIA_SETTINGS_EVENT, changed);
    window.removeEventListener("storage", changed);
  };
}

// The text form is stable between reads, as useSyncExternalStore needs.
const readSaved = () => JSON.stringify(savedAudioProcessing());
const readDefault = () => JSON.stringify(DEFAULT_AUDIO_PROCESSING);

/** The microphone clean-up chosen in this browser, following changes made anywhere. */
export function useSavedAudioProcessing(): AudioProcessing {
  const saved = useSyncExternalStore(subscribe, readSaved, readDefault);
  return useMemo(() => parseAudioProcessing(saved), [saved]);
}
