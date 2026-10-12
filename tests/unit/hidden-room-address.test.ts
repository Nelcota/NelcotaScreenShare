import { afterEach, expect, test, vi } from "vitest";
import {
  rememberedRoomAddress,
  roomAddressState,
} from "@/features/room/client/hidden-room-address";

const INVITE = "a".repeat(43);

function currentEntry(state: unknown) {
  vi.stubGlobal("window", { history: { state: { usr: state } } });
}

afterEach(() => vi.unstubAllGlobals());

test("each history entry recovers its own room and invite, preserving other route state", () => {
  const first = roomAddressState({ previous: "kept" }, "kfa-mtrx-q2p", INVITE);
  const second = roomAddressState(null, "bbb-bbbb-bbb");
  expect(first).toMatchObject({ previous: "kept" });
  currentEntry(first);
  expect(rememberedRoomAddress()).toBe(`/sala/kfa-mtrx-q2p?convite=${INVITE}`);
  currentEntry(second);
  expect(rememberedRoomAddress()).toBe("/sala/bbb-bbbb-bbb");
  currentEntry(first);
  expect(rememberedRoomAddress()).toBe(`/sala/kfa-mtrx-q2p?convite=${INVITE}`);
});

test("missing or edited history never becomes an unsafe destination", () => {
  for (const state of [null, "invalid", {}, { nelcotaHiddenRoom: null }]) {
    currentEntry(state);
    expect(rememberedRoomAddress()).toBeUndefined();
  }
  currentEntry(roomAddressState(null, "//evil.example"));
  expect(rememberedRoomAddress()).toBeUndefined();
  currentEntry(roomAddressState(null, "kfa-mtrx-q2p", "x?y"));
  expect(rememberedRoomAddress()).toBe("/sala/kfa-mtrx-q2p");
});

test("the recovery does not depend on blocked session storage", () => {
  currentEntry(roomAddressState(null, "kfa-mtrx-q2p", INVITE));
  const storage = vi.fn(() => {
    throw new Error("Storage blocked");
  });
  vi.stubGlobal("sessionStorage", { getItem: storage, setItem: storage });
  expect(rememberedRoomAddress()).toBe(`/sala/kfa-mtrx-q2p?convite=${INVITE}`);
  expect(storage).not.toHaveBeenCalled();
});
