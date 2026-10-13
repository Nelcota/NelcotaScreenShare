import type { RefObject } from "react";
import {
  captureMicrophone,
  createMicrophoneAnalyser,
} from "@/features/room/client/microphone-preview";
import { microphonePermissionDenied } from "@/features/room/client/microphone-errors";
import {
  createMicrophoneCheck,
  type MicrophoneCheck,
} from "@/features/room/domain/microphone-check";
import { logBrowserWarning } from "@/lib/telemetry.client";
import type { AudioProcessing } from "@/features/room/domain/audio-processing";

/** The analyser reads normal speech low on its 0–1 scale: the gain spreads it over the meter. */
const METER_GAIN = 2.5;

export interface MicLevelEvents {
  /** Available microphones (after permission, with names). */
  onDevices: (devices: MediaDeviceInfo[]) => void;
  /** The device actually opened, which can differ from the requested preference. */
  onDevice: (capturedId: string | undefined, requestedId: string | undefined) => void;
  /** The chosen microphone disappeared (disconnected): fall back to the default. */
  onMissingDevice: () => void;
  onPermissionDenied: () => void;
  onError: (error: unknown) => void;
  onCheck: (state: MicrophoneCheck, deviceId: string | undefined) => void;
}

interface MicLevelOptions {
  meterStyle: CSSStyleDeclaration;
  mediaDevices: MediaDevices;
  deviceId: string | undefined;
  /** The clean-up the call will use, so the test sounds like the call. */
  processing: AudioProcessing;
  levelRef: RefObject<number>;
  events: MicLevelEvents;
}

interface CaptureState {
  cancelled: boolean;
  frame: number;
  cleanup: (() => void) | undefined;
  captureRevision: number;
  devicesRevision: number;
  capturedId: string | undefined;
}

interface MicLevelCapture extends MicLevelOptions {
  state: CaptureState;
}

type MicrophoneTrack = Awaited<ReturnType<typeof captureMicrophone>>;
type MicrophoneAnalyser = ReturnType<typeof createMicrophoneAnalyser>;

/** The effect was torn down or a newer capture replaced this one. */
function isStale(capture: MicLevelCapture, revision: number) {
  return capture.state.cancelled || revision !== capture.state.captureRevision;
}

function stopCapture(capture: MicLevelCapture) {
  const { state } = capture;
  cancelAnimationFrame(state.frame);
  const release = state.cleanup;
  state.cleanup = undefined;
  release?.();
  capture.meterStyle.transform = "scaleX(0)";
  capture.levelRef.current = 0;
}

function fail(capture: MicLevelCapture, error: unknown, revision: number) {
  if (isStale(capture, revision)) return;
  capture.state.captureRevision += 1;
  stopCapture(capture);
  capture.events.onCheck("starting", capture.state.capturedId);
  if (microphonePermissionDenied(error)) {
    capture.events.onPermissionDenied();
    return;
  }
  capture.events.onError(error);
}

async function refreshDevices(capture: MicLevelCapture, revision: number) {
  const { state, deviceId, events } = capture;
  const refreshRevision = ++state.devicesRevision;
  try {
    const list = await capture.mediaDevices.enumerateDevices();
    if (isStale(capture, revision) || refreshRevision !== state.devicesRevision) return;
    const inputs = list.filter((device) => device.kind === "audioinput" && device.deviceId);
    events.onDevices(inputs);
    if (deviceId && !inputs.some((device) => device.deviceId === deviceId)) {
      events.onMissingDevice();
    }
  } catch (error) {
    if (refreshRevision !== state.devicesRevision) return;
    fail(capture, error, revision);
  }
}

/** Keeps the opened track (restarting when it ends) and returns its analyser. */
function holdTrack(
  capture: MicLevelCapture,
  track: MicrophoneTrack,
  revision: number,
): MicrophoneAnalyser {
  let analyser: MicrophoneAnalyser | undefined;
  const handleEnded = () => {
    if (isStale(capture, revision)) return;
    capture.events.onCheck("starting", capture.state.capturedId);
    void startCapture(capture);
  };
  // Register release before anything that can fail after opening the microphone.
  capture.state.cleanup = () => {
    track.removeEventListener("ended", handleEnded);
    track.stop();
    // The capture is already stopped, even if closing its AudioContext fails.
    void analyser?.cleanup().catch((error: unknown) => {
      logBrowserWarning("Could not close the microphone analyser", error);
    });
  };
  track.addEventListener("ended", handleEnded);
  analyser = createMicrophoneAnalyser(track);
  return analyser;
}

/** Writes the voice level to the meter every frame and reports check changes. */
function runMeter(capture: MicLevelCapture, analyser: MicrophoneAnalyser, revision: number) {
  const { state, events } = capture;
  const check = createMicrophoneCheck();
  let checkState: MicrophoneCheck = "waiting";
  events.onCheck(checkState, state.capturedId);

  const tick = () => {
    if (isStale(capture, revision)) return;
    try {
      const volume = Math.min(1, analyser.calculateVolume() * METER_GAIN);
      capture.levelRef.current = volume;
      // Perceptual curve: normal speech fills a good part of the meter, not just the tip.
      capture.meterStyle.transform = `scaleX(${Math.sqrt(volume).toFixed(3)})`;
      const next = check(volume, performance.now());
      if (next !== checkState) {
        checkState = next;
        events.onCheck(next, state.capturedId);
      }
      state.frame = requestAnimationFrame(tick);
    } catch (error) {
      fail(capture, error, revision);
    }
  };
  tick();
}

async function startCapture(capture: MicLevelCapture) {
  const { state, deviceId, processing } = capture;
  const revision = ++state.captureRevision;
  stopCapture(capture);
  try {
    const track = await captureMicrophone({ deviceId, ...processing });
    if (isStale(capture, revision)) {
      track.stop();
      return;
    }
    const analyser = holdTrack(capture, track, revision);
    state.capturedId = track.getSettings().deviceId ?? deviceId;
    capture.events.onDevice(state.capturedId, deviceId);
    await refreshDevices(capture, revision);
    if (isStale(capture, revision)) return;
    runMeter(capture, analyser, revision);
  } catch (error) {
    fail(capture, error, revision);
  }
}

/** Starts the local capture and its meter; returns the teardown. */
export function startMicLevel(options: MicLevelOptions): () => void {
  const capture: MicLevelCapture = {
    ...options,
    state: {
      cancelled: false,
      frame: 0,
      cleanup: undefined,
      captureRevision: 0,
      devicesRevision: 0,
      capturedId: options.deviceId,
    },
  };
  const { mediaDevices } = options;
  const handleDeviceChange = () => void refreshDevices(capture, capture.state.captureRevision);
  mediaDevices.addEventListener("devicechange", handleDeviceChange);
  void startCapture(capture);

  return () => {
    capture.state.cancelled = true;
    mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    stopCapture(capture);
  };
}
