import { beforeEach, expect, test, vi } from "vitest";
import { ScreenSharePresets, Track } from "livekit-client";
import type * as React from "react";
import type * as ShareSupport from "@/features/room/domain/share-support";
import type { ShareProfile } from "@/features/room/domain/share-profile";

const capture = vi.hoisted(() => ({
  profile: "automatic" as ShareProfile,
  canShare: true,
  createScreenTracks: vi.fn(),
  publishTrack: vi.fn(),
  unpublishTrack: vi.fn(),
  setScreenShareEnabled: vi.fn(),
  saveProfile: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  reportError: vi.fn(),
  logWarning: vi.fn(),
  startAudio: vi.fn<() => Promise<void>>(),
}));
vi.mock("@/features/room/ui/call/RoomHostProvider", () => ({
  useRoomHost: () => ({ canShare: capture.canShare }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useEffect: () => {},
  useState: <T>(initial: T | (() => T)): [T, () => void] => [
    typeof initial === "function" ? (initial as () => T)() : initial,
    () => {},
  ],
}));
vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => ({ startAudio: capture.startAudio }),
  useLocalParticipant: () => ({
    isScreenShareEnabled: false,
    localParticipant: {
      publishTrack: capture.publishTrack,
      unpublishTrack: capture.unpublishTrack,
      setScreenShareEnabled: capture.setScreenShareEnabled,
    },
  }),
}));
vi.mock("@/features/room/client/screen-capture", () => ({
  captureScreenTracks: capture.createScreenTracks,
}));
vi.mock("@/features/room/client/saved-share-profile", () => ({
  savedShareProfile: () => capture.profile,
  saveShareProfile: capture.saveProfile,
}));
vi.mock("@/features/room/hooks/use-share-support", () => ({ useShareSupport: () => "full" }));
vi.mock("@/features/room/domain/share-support", async (original) => ({
  ...(await original<typeof ShareSupport>()),
  canRestrictOwnAudio: () => true,
}));
vi.mock("@/lib/telemetry.client", () => ({
  reportBrowserError: capture.reportError,
  logBrowserWarning: capture.logWarning,
}));
vi.mock("sonner", () => ({ toast: { info: capture.toastInfo, error: capture.toastError } }));

const { useScreenShare } = await import("@/features/room/hooks/use-screen-share");

function screenTrack() {
  return {
    source: Track.Source.ScreenShare,
    stop: vi.fn(),
    mediaStreamTrack: { getSettings: () => ({ displaySurface: "monitor" }) },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  capture.profile = "automatic";
  capture.canShare = true;
  capture.createScreenTracks.mockResolvedValue([screenTrack()]);
  capture.publishTrack.mockResolvedValue(undefined);
  capture.unpublishTrack.mockResolvedValue(undefined);
  capture.startAudio.mockResolvedValue(undefined);
});

test.each([
  ["text", "h1080fps15", "text"],
  ["video", "h1080fps30", "motion"],
  ["data-saver", "h720fps15", "detail"],
] as const)(
  "%s passes capture targets and publication encoding to LiveKit",
  async (profile, preset, contentHint) => {
    capture.profile = profile;
    await useScreenShare().start({ surface: "monitor", audio: false });
    expect(capture.createScreenTracks).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        contentHint,
        resolution: ScreenSharePresets[preset].resolution,
        selfBrowserSurface: "exclude",
      }),
    );
    expect(capture.publishTrack).toHaveBeenCalledWith(expect.anything(), {
      screenShareEncoding: ScreenSharePresets[preset].encoding,
    });
  },
);

test.each(["monitor", "window"] as const)(
  "a %s with sound asks the picker for the computer audio",
  async (surface) => {
    await useScreenShare().start({ surface, audio: true });
    expect(capture.createScreenTracks).toHaveBeenCalledWith(
      expect.objectContaining({ systemAudio: "include", windowAudio: "system" }),
    );
  },
);

test("a share without sound asks the picker for no computer audio", async () => {
  await useScreenShare().start({ surface: "window", audio: false });
  expect(capture.createScreenTracks).toHaveBeenCalledWith(
    expect.objectContaining({ audio: false, systemAudio: "exclude", windowAudio: "exclude" }),
  );
});

test.each(["text", "video", "data-saver"] as const)(
  "%s discards unsafe computer audio before publication",
  async (profile) => {
    capture.profile = profile;
    const video = screenTrack();
    const audio = {
      source: Track.Source.ScreenShareAudio,
      stop: vi.fn(),
      mediaStreamTrack: { getSettings: () => ({}) },
    };
    capture.createScreenTracks.mockResolvedValue([video, audio]);
    await useScreenShare().start({ surface: "monitor", audio: true });
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(video.stop).not.toHaveBeenCalled();
    expect(capture.publishTrack).toHaveBeenCalledTimes(1);
    expect(capture.publishTrack).toHaveBeenCalledWith(video, expect.anything());
    expect(capture.toastInfo).toHaveBeenCalledOnce();
  },
);

test("a publication failure unpublishes and stops every captured track", async () => {
  const video = screenTrack();
  const audio = {
    source: Track.Source.ScreenShareAudio,
    stop: vi.fn(),
    mediaStreamTrack: { getSettings: () => ({ restrictOwnAudio: true }) },
  };
  capture.createScreenTracks.mockResolvedValue([video, audio]);
  capture.publishTrack.mockRejectedValueOnce(new Error("Publication failed"));
  await useScreenShare().start({ surface: "monitor", audio: true });
  expect(capture.unpublishTrack).toHaveBeenCalledWith(video);
  expect(capture.unpublishTrack).toHaveBeenCalledWith(audio);
  expect(video.stop).toHaveBeenCalledOnce();
  expect(audio.stop).toHaveBeenCalledOnce();
  expect(capture.toastError).toHaveBeenCalledOnce();
});

test("cancelling capture does not publish tracks and keeps errors out of telemetry", async () => {
  capture.createScreenTracks.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
  await useScreenShare().start({ surface: "browser", audio: true });
  expect(capture.publishTrack).not.toHaveBeenCalled();
  expect(capture.reportError).not.toHaveBeenCalled();
  expect(capture.toastInfo).toHaveBeenCalledOnce();
});

test("host restriction does not open capture or publish a screen", async () => {
  capture.canShare = false;
  await useScreenShare().start({ surface: "monitor", audio: true });
  expect(capture.createScreenTracks).not.toHaveBeenCalled();
  expect(capture.publishTrack).not.toHaveBeenCalled();
  expect(capture.toastInfo).toHaveBeenCalledWith(
    "O anfitrião restringiu o compartilhamento de tela.",
    expect.objectContaining({ className: "pointer-events-none" }),
  );
});

function watchableScreenTrack() {
  const video = screenTrack();
  return {
    ...video,
    mediaStreamTrack: { ...video.mediaStreamTrack, addEventListener: vi.fn() },
  };
}

function safeScreenAudio() {
  return {
    source: Track.Source.ScreenShareAudio,
    stop: vi.fn(),
    mediaStreamTrack: { getSettings: () => ({ restrictOwnAudio: true }) },
  };
}

test("a capture with sound unlocks the room's playback, as LiveKit's own capture does", async () => {
  capture.createScreenTracks.mockResolvedValue([watchableScreenTrack(), safeScreenAudio()]);
  await useScreenShare().start({ surface: "monitor", audio: true });
  expect(capture.startAudio).toHaveBeenCalledOnce();
});

test("a capture without sound leaves the room's playback alone", async () => {
  await useScreenShare().start({ surface: "monitor", audio: true });
  expect(capture.startAudio).not.toHaveBeenCalled();
});

test("a blocked playback only warns and the screen still goes out", async () => {
  const video = watchableScreenTrack();
  capture.createScreenTracks.mockResolvedValue([video, safeScreenAudio()]);
  capture.startAudio.mockRejectedValue(new DOMException("Blocked", "NotAllowedError"));
  await useScreenShare().start({ surface: "monitor", audio: true });
  await vi.waitFor(() => expect(capture.logWarning).toHaveBeenCalledOnce());
  expect(capture.publishTrack).toHaveBeenCalledWith(video, expect.anything());
  expect(capture.toastError).not.toHaveBeenCalled();
});
