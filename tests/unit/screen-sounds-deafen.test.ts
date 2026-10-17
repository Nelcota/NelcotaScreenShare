import { beforeEach, expect, test, vi } from "vitest";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import type * as React from "react";

const state = vi.hoisted(() => ({
  deafened: false,
  effects: [] as (() => unknown)[],
  play: vi.fn(),
  noticeWatching: vi.fn(),
  handlers: new Map<string, (publication: { source: string }) => void>(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useEffect: (effect: () => unknown) => {
    state.effects.push(effect);
  },
  useEffectEvent: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: <T>(initial: T | (() => T)): [T, () => void] => [
    typeof initial === "function" ? (initial as () => T)() : initial,
    () => {},
  ],
}));
vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => ({
    state: ConnectionState.Connected,
    remoteParticipants: new Map(),
    on(event: string, handler: (publication: { source: string }) => void) {
      state.handlers.set(event, handler);
      return this;
    },
    off() {
      return this;
    },
  }),
}));
vi.mock("@/features/room/ui/dock/Deafen", () => ({
  useDeafen: () => ({ deafened: state.deafened }),
}));
vi.mock("@/features/room/audio/call-sounds", () => ({
  playCallSound: state.play,
  playPeerSound: vi.fn(),
}));
vi.mock("@/features/room/client/screen-watch-notice", () => ({
  noticeWatching: state.noticeWatching,
}));
vi.mock("@/features/room/client/call-notices", () => ({ showCallNotice: vi.fn() }));
const { ScreenWatchProvider } = await import("@/features/room/hooks/use-screen-watch");
const { useRoomNotices } = await import("@/features/room/hooks/use-room-notices");

beforeEach(() => {
  vi.clearAllMocks();
  state.effects = [];
  state.handlers.clear();
});

test.each([true, false])(
  "watch actions respect deafened=%s while still notifying the sharer",
  (deafened) => {
    state.deafened = deafened;
    const element = ScreenWatchProvider({ children: null });
    const { value } = element.props as {
      value: { watch: (sid: string) => void; stopWatching: (sid: string) => void };
    };
    value.watch("TR_screen");
    value.stopWatching("TR_screen");
    expect(state.noticeWatching).toHaveBeenCalledTimes(2);
    expect(state.play).toHaveBeenCalledTimes(deafened ? 0 : 2);
  },
);

test.each([true, false])("own screen events respect deafened=%s", (deafened) => {
  state.deafened = deafened;
  useRoomNotices();
  for (const effect of state.effects) effect();
  state.handlers.get(RoomEvent.LocalTrackPublished)?.({ source: Track.Source.ScreenShare });
  state.handlers.get(RoomEvent.LocalTrackUnpublished)?.({ source: Track.Source.ScreenShare });
  expect(state.play).toHaveBeenCalledTimes(deafened ? 0 : 2);
});
