import { announceMediaSetting } from "./saved-media";
import { currentSavedDevice, readSavedDevice, writeSavedDevice } from "./saved-device-store";

const MIC_KEY = "nelcota:microfone";

/** Microphone chosen last time in this browser (convenience; may not exist). */
export function savedMicrophone(): string | undefined {
  return readSavedDevice(MIC_KEY)?.id;
}

/** The name of the saved microphone, to find it again under a new id. */
export function savedMicrophoneLabel(): string | undefined {
  return readSavedDevice(MIC_KEY)?.label || undefined;
}

/** The saved microphone's id now, found by name when the browser gave it a new id. */
export function currentMicrophone(): Promise<string | undefined> {
  return currentSavedDevice(MIC_KEY, "audioinput");
}

export function saveMicrophone(deviceId: string | undefined) {
  writeSavedDevice(MIC_KEY, "audioinput", deviceId);
  announceMediaSetting("microphone");
}
