import { expect, test, vi } from "vitest";
import {
  applyCallTabMessage,
  CALL_CHANNEL_NAME,
  firstOtherTabCall,
  NO_OTHER_TAB_CALLS,
  openCallTabs,
  parseCallTabMessage,
  type CallChannel,
  type CallTabMessage,
  type OtherTabCalls,
} from "@/features/room/client/call-tabs";

/** In-memory BroadcastChannel: delivers synchronously to every other open channel. */
function channelHub() {
  const open = new Set<FakeChannel>();
  const names: string[] = [];

  class FakeChannel implements CallChannel {
    private readonly listeners = new Set<(data: unknown) => void>();
    send(message: CallTabMessage) {
      for (const channel of open) {
        if (channel !== this) channel.deliver(message);
      }
    }
    listen(listener: (data: unknown) => void) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    close() {
      open.delete(this);
    }
    deliver(data: unknown) {
      for (const listener of this.listeners) listener(data);
    }
  }

  return {
    names,
    open,
    createChannel: (name: string) => {
      names.push(name);
      const channel = new FakeChannel();
      open.add(channel);
      return channel;
    },
    /** Something else on the same channel (another app version, garbage). */
    broadcast: (data: unknown) => {
      for (const channel of open) channel.deliver(data);
    },
  };
}

test("only well-formed messages are understood", () => {
  expect(parseCallTabMessage({ type: "active", from: "a", code: "abc-defg-hij" })).toEqual({
    type: "active",
    from: "a",
    code: "abc-defg-hij",
  });
  expect(parseCallTabMessage({ type: "leave", from: "a", target: "b" })).toBeDefined();
  expect(parseCallTabMessage({ type: "active", from: "a" })).toBeUndefined();
  expect(parseCallTabMessage({ type: "takeover", from: "a" })).toBeUndefined();
  expect(parseCallTabMessage("active")).toBeUndefined();
  expect(parseCallTabMessage(null)).toBeUndefined();
});

test("the list follows calls that start and end in other tabs", () => {
  const started = applyCallTabMessage(NO_OTHER_TAB_CALLS, {
    type: "active",
    from: "a",
    code: "abc-defg-hij",
  });
  expect(firstOtherTabCall(started)).toBe("abc-defg-hij");
  expect(applyCallTabMessage(started, { type: "active", from: "a", code: "abc-defg-hij" })).toBe(
    started,
  );
  expect(applyCallTabMessage(started, { type: "query", from: "b" })).toBe(started);
  const ended = applyCallTabMessage(started, { type: "ended", from: "a" });
  expect(firstOtherTabCall(ended)).toBeUndefined();
  expect(applyCallTabMessage(ended, { type: "ended", from: "a" })).toBe(ended);
  // The original list is never changed.
  expect(firstOtherTabCall(started)).toBe("abc-defg-hij");
});

test("without BroadcastChannel there is no check", () => {
  expect(openCallTabs({ tabId: "a", createChannel: () => undefined })).toBeUndefined();
});

test("a new tab finds a call that was already open, then sees it end", () => {
  const hub = channelHub();
  const inCall = openCallTabs({ tabId: "a", createChannel: hub.createChannel })!;
  const stop = inCall.announceCall("abc-defg-hij", () => {});
  const joining = openCallTabs({ tabId: "b", createChannel: hub.createChannel })!;
  const onChange = vi.fn<(calls: OtherTabCalls) => void>();
  joining.watchOtherCalls(onChange);

  expect(hub.names).toEqual([CALL_CHANNEL_NAME, CALL_CHANNEL_NAME]);
  expect(firstOtherTabCall(onChange.mock.lastCall![0])).toBe("abc-defg-hij");
  stop();
  stop();
  expect(firstOtherTabCall(onChange.mock.lastCall![0])).toBeUndefined();
  expect(onChange).toHaveBeenCalledTimes(2);
});

test("a call that starts later reaches a tab already watching", () => {
  const hub = channelHub();
  const joining = openCallTabs({ tabId: "b", createChannel: hub.createChannel })!;
  const onChange = vi.fn<(calls: OtherTabCalls) => void>();
  joining.watchOtherCalls(onChange);
  const inCall = openCallTabs({ tabId: "a", createChannel: hub.createChannel })!;
  inCall.announceCall("abc-defg-hij", () => {});

  expect(firstOtherTabCall(onChange.mock.lastCall![0])).toBe("abc-defg-hij");
});

test("a tab ignores its own call and garbage on the channel", () => {
  const hub = channelHub();
  const tab = openCallTabs({ tabId: "a", createChannel: hub.createChannel })!;
  const onChange = vi.fn<(calls: OtherTabCalls) => void>();
  tab.watchOtherCalls(onChange);
  // The same tab on a second channel (e.g. the call and the pre-join of the same page).
  const sameTab = openCallTabs({ tabId: "a", createChannel: hub.createChannel })!;
  sameTab.announceCall("abc-defg-hij", () => {});
  hub.broadcast({ type: "active", from: "z" });
  hub.broadcast("hello");

  expect(onChange).not.toHaveBeenCalled();
});

test("taking over asks only the tabs in a call to leave", () => {
  const hub = channelHub();
  const leaveA = vi.fn();
  const leaveC = vi.fn();
  openCallTabs({ tabId: "a", createChannel: hub.createChannel })!.announceCall("sala-um", leaveA);
  openCallTabs({ tabId: "c", createChannel: hub.createChannel })!.announceCall("sala-dois", leaveC);
  const joining = openCallTabs({ tabId: "b", createChannel: hub.createChannel })!;
  let calls = NO_OTHER_TAB_CALLS;
  joining.watchOtherCalls((next) => {
    calls = next;
  });

  joining.askToLeave(new Map([["a", "sala-um"]]));
  expect(leaveA).toHaveBeenCalledTimes(1);
  expect(leaveC).not.toHaveBeenCalled();
  joining.askToLeave(calls);
  expect(leaveC).toHaveBeenCalledTimes(1);
});

test("closing stops listening and releases the channel", () => {
  const hub = channelHub();
  const tab = openCallTabs({ tabId: "b", createChannel: hub.createChannel })!;
  const onChange = vi.fn<(calls: OtherTabCalls) => void>();
  tab.watchOtherCalls(onChange);
  tab.close();
  openCallTabs({ tabId: "a", createChannel: hub.createChannel })!.announceCall("abc", () => {});

  expect(onChange).not.toHaveBeenCalled();
  expect(hub.open.size).toBe(1);
});
