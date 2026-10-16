import { afterEach, beforeEach, expect, test, vi } from "vitest";

const preferences = vi.hoisted(() => ({ callSounds: true }));
vi.mock("@/features/notifications/client/preferences-store", () => ({
  currentNotificationPreferences: () => preferences,
}));
vi.mock("@/features/room/audio/chosen-output", () => ({ routeToChosenOutput: vi.fn() }));

const frequencies: number[] = [];

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createOscillator() {
    return {
      type: "",
      frequency: { setValueAtTime: (value: number) => frequencies.push(value) },
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
  preferences.callSounds = true;
  vi.stubGlobal("AudioContext", FakeAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

const { playCallSound } = await import("@/features/room/audio/call-sounds");

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
