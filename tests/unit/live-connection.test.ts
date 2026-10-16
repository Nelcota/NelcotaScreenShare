import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { startLiveConnection } from "@/features/live/client/live-connection";

class Stream extends EventTarget {
  static CLOSED = 2;
  static opened: Stream[] = [];
  readyState = 1;
  constructor(_url: string) {
    super();
    Stream.opened.push(this);
  }
  close() {
    this.readyState = Stream.CLOSED;
  }
}
let documentState: EventTarget & { visibilityState: string };
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  Stream.opened = [];
  documentState = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", documentState);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("EventSource", Stream);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ session: true })),
  );
});
afterEach(() => {
  stop?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("receives background nudges after more than five minutes", async () => {
  const refresh = vi.fn();
  stop = startLiveConnection(refresh);
  const stream = Stream.opened[0]!;
  stream.dispatchEvent(new Event("open"));
  documentState.visibilityState = "hidden";
  documentState.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(6 * 60_000);
  expect(stream.readyState).toBe(1);
  stream.dispatchEvent(new MessageEvent("nudge", { data: "friends" }));
  await vi.advanceTimersByTimeAsync(300);
  expect(refresh).toHaveBeenCalledOnce();
});

test("reconnects and catches up while the tab is hidden", async () => {
  const refresh = vi.fn();
  stop = startLiveConnection(refresh);
  documentState.visibilityState = "hidden";
  const stream = Stream.opened[0]!;
  stream.close();
  stream.dispatchEvent(new Event("error"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(Stream.opened).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(300);
  expect(refresh).toHaveBeenCalled();
});
