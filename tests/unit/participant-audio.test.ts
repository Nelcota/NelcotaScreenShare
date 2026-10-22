import { expect, test } from "vitest";
import {
  DEFAULT_PARTICIPANT_AUDIO,
  normalizeAudioLevel,
  playbackVolume,
  silencedByDeafen,
} from "@/features/room/domain/participant-audio";

test("voice and shared sound have independent playback levels", () => {
  const settings = { voice: 40, sharedAudio: 75, muted: false };
  expect(playbackVolume(settings, "voice", false)).toBe(0.4);
  expect(playbackVolume(settings, "sharedAudio", false)).toBe(0.75);
  expect(playbackVolume(DEFAULT_PARTICIPANT_AUDIO, "voice", false)).toBe(1);
});

test.each(["voice", "sharedAudio"] as const)(
  "%s stays silent while locally muted without losing its level",
  (source) => {
    const settings = { voice: 40, sharedAudio: 75, muted: false };
    expect(playbackVolume({ ...settings, muted: true }, source, false)).toBe(0);
    expect(playbackVolume({ ...settings, muted: true }, source, true)).toBe(0);
    expect(playbackVolume(settings, source, false)).toBe(settings[source] / 100);
    expect(settings).toEqual({ voice: 40, sharedAudio: 75, muted: false });
  },
);

test("deafening silences the voices and keeps the watched screen's sound", () => {
  const settings = { voice: 40, sharedAudio: 75, muted: false };
  expect(playbackVolume(settings, "voice", true)).toBe(0);
  expect(playbackVolume(settings, "sharedAudio", true)).toBe(0.75);
  expect(silencedByDeafen("voice", true)).toBe(true);
  expect(silencedByDeafen("sharedAudio", true)).toBe(false);
  expect(silencedByDeafen("voice", false)).toBe(false);
});

test("playback never amplifies or accepts a nonfinite level", () => {
  expect(normalizeAudioLevel(-20)).toBe(0);
  expect(normalizeAudioLevel(150)).toBe(100);
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expect(normalizeAudioLevel(invalid)).toBe(100);
  }
  expect(playbackVolume({ voice: -1, sharedAudio: 200, muted: false }, "voice", false)).toBe(0);
  expect(playbackVolume({ voice: -1, sharedAudio: 200, muted: false }, "sharedAudio", false)).toBe(
    1,
  );
});
