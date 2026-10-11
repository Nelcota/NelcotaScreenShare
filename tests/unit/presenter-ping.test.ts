import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type * as React from "react";
import { encodeMessage } from "@/features/room/domain/data-channel";
import { usePresenterPing } from "@/features/room/hooks/use-presenter-ping";

interface Incoming {
  from?: { identity: string };
  payload: Uint8Array;
}

const capture = vi.hoisted(() => ({
  receive: undefined as ((message: Incoming) => void) | undefined,
  setPing: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useRef: (initial: unknown) => ({ current: initial }),
  useState: <T>(initial: T | (() => T)): [T, typeof capture.setPing] => [
    typeof initial === "function" ? (initial as () => T)() : initial,
    capture.setPing,
  ],
}));
vi.mock("@livekit/components-react", () => ({
  useDataChannel: (_topic: string, onMessage: (message: Incoming) => void) => {
    capture.receive = onMessage;
    return {};
  },
}));
vi.mock("@/lib/hooks/use-timeouts", () => ({
  useTimeouts: () => (callback: () => void, delay: number) => setTimeout(callback, delay),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.clearAllMocks();
  capture.receive = undefined;
  usePresenterPing("owner", "TR_owned");
});
afterEach(() => vi.useRealTimers());

function receive(message: Incoming) {
  if (!capture.receive) throw new Error("Missing screen statistics subscription");
  capture.receive(message);
}

function sample(pingMs: number) {
  receive({
    from: { identity: "owner" },
    payload: encodeMessage({ trackSid: "TR_owned", pingMs }),
  });
}

test("only the focused screen's owner can supply a validated ping", () => {
  const payload = encodeMessage({ trackSid: "TR_owned", pingMs: 42 });
  receive({ from: { identity: "someone-else" }, payload });
  receive({ payload });
  receive({
    from: { identity: "owner" },
    payload: encodeMessage({ trackSid: "TR_other", pingMs: 42 }),
  });
  vi.advanceTimersByTime(2000);
  sample(-1);
  expect(capture.setPing).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000);
  sample(42);
  expect(capture.setPing).toHaveBeenCalledExactlyOnceWith(42);
});

test("an older expiry cannot clear a newer sample, which expires after six seconds", () => {
  sample(10);
  vi.advanceTimersByTime(2000);
  sample(20);
  vi.advanceTimersByTime(4000);
  expect(capture.setPing).toHaveBeenLastCalledWith(20);
  expect(capture.setPing).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(2000);
  expect(capture.setPing).toHaveBeenLastCalledWith(null);
});
