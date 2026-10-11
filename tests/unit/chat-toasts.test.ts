import { EventEmitter } from "node:events";
import { RoomEvent, type Participant } from "livekit-client";
import { beforeEach, expect, test, vi } from "vitest";
import type * as React from "react";
import { useChatToasts } from "@/features/room/hooks/use-chat-toasts";

interface NoticeOptions {
  id: string;
  onAutoClose: () => void;
  onDismiss: () => void;
}

const capture = vi.hoisted(() => ({
  room: undefined as EventEmitter | undefined,
  cleanup: undefined as (() => void) | undefined,
  toast: vi.fn<(text: string, options: NoticeOptions) => void>(),
  dismiss: vi.fn(),
}));
vi.mock("@livekit/components-react", () => ({ useRoomContext: () => capture.room }));
vi.mock("sonner", () => ({ toast: Object.assign(capture.toast, { dismiss: capture.dismiss }) }));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => () => void) => {
    capture.cleanup = effect();
  },
}));

let show: ReturnType<typeof useChatToasts>;
beforeEach(() => {
  vi.clearAllMocks();
  capture.room = new EventEmitter();
  capture.cleanup = undefined;
  show = useChatToasts();
});

function notice(id: string, identity?: string) {
  show({
    id,
    author: identity ? ({ identity } as Participant) : undefined,
    text: id,
    onOpen: () => {},
  });
}

test("departures dismiss only that author's notices; disconnection dismisses the rest", () => {
  notice("chat-a", "ana");
  notice("chat-b", "beto");
  capture.room?.emit(RoomEvent.ParticipantDisconnected, { identity: "ana" });
  expect(capture.dismiss).toHaveBeenCalledExactlyOnceWith("chat-a");
  capture.room?.emit(RoomEvent.Disconnected);
  expect(capture.dismiss).toHaveBeenLastCalledWith("chat-b");
});

test("unmount dismisses all active notices even before disconnect, including unknown authors", () => {
  notice("chat-known", "ana");
  notice("chat-unknown");
  capture.cleanup?.();
  expect(capture.dismiss).toHaveBeenCalledWith("chat-known");
  expect(capture.dismiss).toHaveBeenCalledWith("chat-unknown");
  expect(capture.dismiss).toHaveBeenCalledTimes(2);
  expect(capture.room?.eventNames()).toEqual([]);
});

test("auto-closed notices are released and never dismissed again on disconnect", () => {
  notice("chat-closed", "ana");
  const options = capture.toast.mock.calls[0]?.[1];
  if (!options) throw new Error("Missing toast lifecycle callbacks");
  options.onAutoClose();
  capture.room?.emit(RoomEvent.Disconnected);
  expect(capture.dismiss).not.toHaveBeenCalled();
});
