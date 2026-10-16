import { describe, expect, test, vi } from "vitest";
import {
  MISSED_NOTICE_MS,
  RING_DURATION_MS,
  RING_SOUND_MS,
  ringSoundLeft,
} from "@/features/ringing/domain/ring";
import { createRingStore } from "@/features/ringing/server/ring-store.server";

const CALL = {
  callerId: "ana",
  callerName: "Ana",
  calleeId: "bia",
  calleeName: "Bia",
  roomCode: "abc-defg-hij",
  conversationId: null,
};

function setup() {
  let time = 1_000_000;
  const store = createRingStore(() => time);
  const ring = store.start(CALL);
  return { store, ring, wait: (ms: number) => (time += ms), now: () => time };
}

describe("ringing", () => {
  test("rings until the time runs out, then the caller sees nobody answered", () => {
    const { store, ring, wait } = setup();
    expect(store.incomingFor("bia").map((item) => item.id)).toEqual([ring.id]);
    expect(store.outgoingFrom("ana")).toEqual([
      expect.objectContaining({ id: ring.id, state: "ringing" }),
    ]);
    wait(RING_DURATION_MS);
    expect(store.incomingFor("bia")).toEqual([]);
    expect(store.outgoingFrom("ana")).toEqual([
      expect.objectContaining({ id: ring.id, state: "missed" }),
    ]);
    wait(MISSED_NOTICE_MS);
    expect(store.outgoingFrom("ana")).toEqual([]);
  });

  test("the sound stops before the ring does", () => {
    const { ring, wait, now } = setup();
    expect(ringSoundLeft(ring, now())).toBe(RING_SOUND_MS);
    wait(RING_SOUND_MS);
    expect(ringSoundLeft(ring, now())).toBe(0);
  });

  test("a decline ends the ring for both and tells the caller at once", () => {
    const { store, ring, wait } = setup();
    expect(store.decline(ring.id, "bia")).not.toBeNull();
    expect(store.incomingFor("bia")).toEqual([]);
    expect(store.outgoingFrom("ana")).toEqual([
      expect.objectContaining({ id: ring.id, calleeName: "Bia", state: "declined" }),
    ]);
    expect(store.accept(ring.id, "bia")).toBeNull();
    expect(store.decline(ring.id, "bia")).toBeNull();
    wait(MISSED_NOTICE_MS);
    expect(store.outgoingFrom("ana")).toEqual([]);
  });

  test("only the callee declines", () => {
    const { store, ring } = setup();
    expect(store.decline(ring.id, "ana")).toBeNull();
    expect(store.outgoingFrom("ana")[0]?.state).toBe("ringing");
  });

  test("only the callee accepts and only the caller cancels; accepting ends it for both", () => {
    const { store, ring } = setup();
    expect(store.accept(ring.id, "ana")).toBeNull();
    expect(store.cancel(ring.id, "bia")).toBeNull();
    expect(store.accept(ring.id, "bia")?.roomCode).toBe("abc-defg-hij");
    expect(store.incomingFor("bia")).toEqual([]);
    expect(store.outgoingFrom("ana")).toEqual([]);
  });

  test("calling the same person again replaces the ring", () => {
    const { store, ring } = setup();
    const again = store.start(CALL);
    expect(again.id).not.toBe(ring.id);
    expect(store.incomingFor("bia").map((item) => item.id)).toEqual([again.id]);
  });
});

describe("the end of a ring", () => {
  test("is told once, whichever read finds it over", () => {
    let time = 1_000_000;
    const ended = vi.fn();
    const store = createRingStore(() => time, ended);
    const ring = store.start(CALL);
    time += RING_DURATION_MS;
    // Any page asking for its rings (here the callee's) finds it over before the timer does.
    store.incomingFor("bia");
    store.sweep();
    store.outgoingFrom("ana");
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ id: ring.id, callerId: "ana" }));
  });

  test("is not told for a decline, which already told both sides", () => {
    let time = 1_000_000;
    const ended = vi.fn();
    const store = createRingStore(() => time, ended);
    const ring = store.start(CALL);
    store.decline(ring.id, "bia");
    time += RING_DURATION_MS;
    store.sweep();
    expect(ended).not.toHaveBeenCalled();
  });
});
