import { afterEach, beforeEach, expect, test, vi } from "vitest";

const preferences = vi.hoisted(() => ({ callSounds: true }));
vi.mock("@/features/notifications/client/preferences-store", () => ({
  currentNotificationPreferences: () => preferences,
}));
vi.mock("@/features/room/audio/chosen-output", () => ({ routeToChosenOutput: vi.fn() }));

const frequencies: number[] = [];
/** Where each gliding note ends up. */
const glides: number[] = [];

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createOscillator() {
    return {
      type: "",
      frequency: {
        setValueAtTime: (value: number) => frequencies.push(value),
        exponentialRampToValueAtTime: (value: number) => glides.push(value),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}

beforeEach(() => {
  frequencies.length = 0;
  glides.length = 0;
  preferences.callSounds = true;
  vi.stubGlobal("AudioContext", FakeAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

const { playCallSound, playPeerSound } = await import("@/features/room/audio/call-sounds");

test("turning the microphone on rises and turning it off falls", async () => {
  await playCallSound("mic-on");
  const [low, high] = frequencies;
  expect(frequencies).toHaveLength(2);
  expect(high).toBeGreaterThan(low ?? 0);
  frequencies.length = 0;
  await playCallSound("mic-off");
  expect(frequencies).toEqual([high, low]);
});

test("the room's sound has its own, lower pair", async () => {
  await playCallSound("deafen");
  await playCallSound("hear-again");
  expect(frequencies).toHaveLength(4);
  expect(Math.max(...frequencies)).toBeLessThan(660);
});

test("nothing plays when Sons da chamada is off", async () => {
  preferences.callSounds = false;
  await playCallSound("mic-on");
  expect(frequencies).toHaveLength(0);
});

test("leaving yourself rolls a chord down; someone else is a single gliding note", async () => {
  await playCallSound("leave");
  expect(frequencies).toHaveLength(3);
  expect(frequencies).toEqual([...frequencies].toSorted((a, b) => b - a));
  expect(glides).toHaveLength(0);

  frequencies.length = 0;
  await playPeerSound("peer-left", 10_000);
  const [start] = frequencies;
  expect(frequencies).toHaveLength(1);
  expect(glides[0]).toBeLessThan(start ?? 0);

  frequencies.length = 0;
  glides.length = 0;
  await playPeerSound("peer-joined", 20_000);
  expect(frequencies).toHaveLength(1);
  expect(glides[0]).toBeGreaterThan(frequencies[0] ?? 0);
});

test("ten people at once make one sound, then another only after 2 s", async () => {
  for (let person = 0; person < 10; person++) await playPeerSound("peer-joined", 30_000 + person);
  expect(frequencies).toHaveLength(1);
  await playPeerSound("peer-left", 31_999);
  expect(frequencies).toHaveLength(1);
  await playPeerSound("peer-left", 32_010);
  expect(frequencies).toHaveLength(2);
});

test("someone else coming in stays silent when Sons da chamada is off", async () => {
  preferences.callSounds = false;
  await playPeerSound("peer-joined", 50_000);
  expect(frequencies).toHaveLength(0);
});
