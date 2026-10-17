import { afterEach, expect, test, vi } from "vitest";
import { ScreenSharePresets, TrackInvalidError } from "livekit-client";
import {
  captureScreenTracks,
  displayMediaOptions,
  type ScreenCaptureOptions,
} from "@/features/room/client/screen-capture";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const OPTIONS: ScreenCaptureOptions = {
  video: { displaySurface: "window" },
  audio: { echoCancellation: false },
  systemAudio: "include",
  windowAudio: "system",
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  resolution: ScreenSharePresets.h1080fps30.resolution,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the picker receives windowAudio, which LiveKit's own capture drops", () => {
  expect(displayMediaOptions(OPTIONS, false)).toEqual({
    audio: { echoCancellation: false },
    video: {
      displaySurface: "window",
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: 30,
    },
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: "include",
    windowAudio: "system",
  });
});

test("Safari gets the size as a maximum, as in LiveKit", () => {
  expect(displayMediaOptions(OPTIONS, true).video).toEqual({
    displaySurface: "window",
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: 30,
  });
});

test("without a resolution the video constraints stay as given", () => {
  const options = { ...OPTIONS, resolution: undefined };
  expect(displayMediaOptions(options, false).video).toEqual({ displaySurface: "window" });
});

test("a capture without video fails before creating any track", async () => {
  const getDisplayMedia = vi.fn().mockResolvedValue({
    getVideoTracks: () => [],
    getAudioTracks: () => [],
  });
  vi.stubGlobal("navigator", {
    userAgent: CHROME,
    maxTouchPoints: 0,
    mediaDevices: { getDisplayMedia },
  });
  await expect(captureScreenTracks(OPTIONS)).rejects.toBeInstanceOf(TrackInvalidError);
  expect(getDisplayMedia).toHaveBeenCalledWith(
    expect.objectContaining({ windowAudio: "system", systemAudio: "include" }),
  );
});
