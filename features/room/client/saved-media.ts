import {
  parseAudioProcessing,
  type AudioProcessing,
} from "@/features/room/domain/audio-processing";
import { currentSavedDevice, readSavedDevice, writeSavedDevice } from "./saved-device-store";

const OUTPUT_KEY = "nelcota:saida-som";
const CAMERA_KEY = "nelcota:camera";
const PROCESSING_KEY = "nelcota:audio-limpeza";

/** Fired on `window` when a media choice changes, so a call already open can follow it. */
export const MEDIA_SETTINGS_EVENT = "nelcota:media-settings";

export type MediaSettingKind = "microphone" | "output" | "camera" | "processing";

export function announceMediaSetting(kind: MediaSettingKind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MediaSettingKind>(MEDIA_SETTINGS_EVENT, { detail: kind }));
}

/** Where the room plays, chosen in this browser; none means the system default. */
export function savedOutput(): string | undefined {
  return readSavedDevice(OUTPUT_KEY)?.id;
}

/** The saved output's id now, found by name when the browser gave it a new id. */
export function currentOutput(): Promise<string | undefined> {
  return currentSavedDevice(OUTPUT_KEY, "audiooutput");
}

export function saveOutput(deviceId: string | undefined) {
  writeSavedDevice(OUTPUT_KEY, "audiooutput", deviceId);
  announceMediaSetting("output");
}

/** The camera chosen in this browser; none means the browser picks. */
export function savedCamera(): string | undefined {
  return readSavedDevice(CAMERA_KEY)?.id;
}

/** The saved camera's id now, found by name when the browser gave it a new id. */
export function currentCamera(): Promise<string | undefined> {
  return currentSavedDevice(CAMERA_KEY, "videoinput");
}

export function saveCamera(deviceId: string | undefined) {
  writeSavedDevice(CAMERA_KEY, "videoinput", deviceId);
  announceMediaSetting("camera");
}

export function savedAudioProcessing(): AudioProcessing {
  try {
    return parseAudioProcessing(localStorage.getItem(PROCESSING_KEY));
  } catch {
    return parseAudioProcessing(null);
  }
}

export function saveAudioProcessing(processing: AudioProcessing) {
  try {
    localStorage.setItem(PROCESSING_KEY, JSON.stringify(processing));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  announceMediaSetting("processing");
}

const JOIN_MIC_KEY = "nelcota:entrar-com-microfone";

/** "Entrar com microfone ligado" as chosen last time in this browser; on the first time. */
export function joinsWithMicrophone(): boolean {
  try {
    return localStorage.getItem(JOIN_MIC_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveJoinsWithMicrophone(on: boolean) {
  try {
    localStorage.setItem(JOIN_MIC_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}
