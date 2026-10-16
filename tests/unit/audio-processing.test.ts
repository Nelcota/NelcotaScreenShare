import { expect, test } from "vitest";
import {
  DEFAULT_AUDIO_PROCESSING,
  parseAudioProcessing,
} from "@/features/room/domain/audio-processing";

test("noise, echo and gain clean-up start on", () => {
  expect(parseAudioProcessing(null)).toEqual({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  });
});

test("a saved choice keeps what was turned off", () => {
  expect(
    parseAudioProcessing(JSON.stringify({ noiseSuppression: false, autoGainControl: false })),
  ).toEqual({ noiseSuppression: false, echoCancellation: true, autoGainControl: false });
});

test("anything not written here falls back to the defaults", () => {
  expect(parseAudioProcessing("{")).toBe(DEFAULT_AUDIO_PROCESSING);
  expect(parseAudioProcessing("[]")).toEqual(DEFAULT_AUDIO_PROCESSING);
  expect(parseAudioProcessing(JSON.stringify({ echoCancellation: "no" }))).toEqual(
    DEFAULT_AUDIO_PROCESSING,
  );
});
