import { afterEach, beforeEach, expect, test, vi } from "vitest";

const telemetry = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: telemetry.warning }));

const INVITE = "a".repeat(43);

function stubStorage(values = new Map<string, string>()) {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  return values;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

test("remembers the room, with its invite, only as a validated room address", async () => {
  stubStorage();
  const address = await import("@/features/room/client/hidden-room-address");
  expect(address.rememberedRoomAddress()).toBeUndefined();
  address.rememberRoomAddress("kfa-mtrx-q2p");
  expect(address.rememberedRoomAddress()).toBe("/sala/kfa-mtrx-q2p");
  address.rememberRoomAddress("kfa-mtrx-q2p", INVITE);
  expect(address.rememberedRoomAddress()).toBe(`/sala/kfa-mtrx-q2p?convite=${INVITE}`);
});

test("edited or broken values never become a destination", async () => {
  const values = stubStorage();
  const address = await import("@/features/room/client/hidden-room-address");
  values.set("nelcota:sala-oculta", JSON.stringify({ code: "//evil.example" }));
  expect(address.rememberedRoomAddress()).toBeUndefined();
  values.set("nelcota:sala-oculta", JSON.stringify({ code: "kfa-mtrx-q2p", invite: "x?y" }));
  expect(address.rememberedRoomAddress()).toBe("/sala/kfa-mtrx-q2p");
  values.set("nelcota:sala-oculta", "{not json");
  expect(address.rememberedRoomAddress()).toBeUndefined();
  expect(telemetry.warning).toHaveBeenCalledTimes(1);
});

test("blocked storage is reported and simply forgets the room", async () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw new Error("Storage blocked");
    },
    setItem: () => {
      throw new Error("Storage blocked");
    },
  });
  const address = await import("@/features/room/client/hidden-room-address");
  address.rememberRoomAddress("kfa-mtrx-q2p");
  expect(address.rememberedRoomAddress()).toBeUndefined();
  expect(telemetry.warning).toHaveBeenCalledTimes(2);
});
