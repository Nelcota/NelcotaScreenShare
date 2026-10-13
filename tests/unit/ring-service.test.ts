import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MISSED_NOTICE_MS, RING_DURATION_MS } from "@/features/ringing/domain/ring";

function call(callerId: string, calleeId: string) {
  return {
    callerId,
    callerName: callerId,
    calleeId,
    calleeName: calleeId,
    roomCode: "abc-defg-hij",
    conversationId: null,
  };
}

/** A fresh service (its store and timer are module state) on fake timers. */
async function service() {
  vi.resetModules();
  return import("@/features/ringing/server/ring-service.server");
}

describe("the ring timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("one timer for every ring, gone once rings and notices are over", async () => {
    const { startRing, outgoingRings } = await service();
    startRing(call("ana", "bia"));
    startRing(call("ana", "caio"));
    startRing(call("davi", "bia"));
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(RING_DURATION_MS + 100);
    expect(outgoingRings("ana").map((ring) => ring.state)).toEqual(["missed", "missed"]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(MISSED_NOTICE_MS + 100);
    expect(outgoingRings("ana")).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("answered, cancelled, declined or replaced rings leave no timer behind", async () => {
    const { startRing, acceptRing, cancelRing, declineRing, outgoingRings } = await service();
    const answered = startRing(call("ana", "bia"));
    acceptRing(answered.id, "bia");
    const cancelled = startRing(call("ana", "caio"));
    cancelRing(cancelled.id, "ana");
    expect(vi.getTimerCount()).toBe(0);
    startRing(call("davi", "bia"));
    startRing(call("davi", "bia"));
    const declined = startRing(call("eva", "bia"));
    declineRing(declined.id, "bia");
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(RING_DURATION_MS + MISSED_NOTICE_MS + 200);
    expect(outgoingRings("davi")).toEqual([]);
    expect(outgoingRings("eva")).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
