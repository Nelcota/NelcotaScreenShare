import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useMicLevel } from "@/features/room/hooks/use-mic-level";

const capture = vi.hoisted(() => ({
  effect: undefined as (() => void | (() => void)) | undefined,
  createTrack: vi.fn(),
  createAnalyser: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => {
    capture.effect = effect;
  },
  useEffectEvent: (handler: unknown) => handler,
  useRef: (value: unknown) => ({ current: value }),
  // Outside a browser the saved clean-up reads its server value: the defaults.
  useSyncExternalStore: (_subscribe: unknown, _read: unknown, readServer: () => unknown) =>
    readServer(),
  useMemo: (create: () => unknown) => create(),
}));

vi.mock("@/features/room/client/microphone-preview", () => ({
  captureMicrophone: capture.createTrack,
  createMicrophoneAnalyser: capture.createAnalyser,
}));

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let now = 0;
const stop = vi.fn();
const dispose = vi.fn();
const volume = vi.fn(() => 0);
const devices = vi.fn(async () => [{ kind: "audioinput", deviceId: "mic-a" }]);
let mediaDevices: EventTarget;
let track: ReturnType<typeof audioTrack>;

function audioTrack(deviceId = "mic-a") {
  return Object.assign(new EventEmitter(), {
    stop,
    getSettings: () => ({ deviceId }),
    addEventListener(this: EventEmitter, name: string, handler: () => void) {
      this.on(name, handler);
    },
    removeEventListener(this: EventEmitter, name: string, handler: () => void) {
      this.off(name, handler);
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  frames.clear();
  frameId = 0;
  now = 0;
  track = audioTrack();
  capture.createTrack.mockReset().mockResolvedValue(track);
  capture.createAnalyser.mockReset();
  capture.createAnalyser.mockReturnValue({ calculateVolume: volume, cleanup: dispose });
  dispose.mockReset().mockResolvedValue(undefined);
  volume.mockReset().mockReturnValue(0);
  devices.mockReset().mockResolvedValue([{ kind: "audioinput", deviceId: "mic-a" }]);
  mediaDevices = Object.assign(new EventTarget(), { enumerateDevices: devices });
  vi.stubGlobal("navigator", { mediaDevices });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => vi.unstubAllGlobals());

/** Runs with the hooks mocked above to control the capture lifecycle. */
function MicLevelHarness(deviceId: string | undefined = "mic-a") {
  const meter = { style: { transform: "" } } as HTMLDivElement;
  const events = {
    onDevices: vi.fn(),
    onDevice: vi.fn(),
    onMissingDevice: vi.fn(),
    onPermissionDenied: vi.fn(),
    onError: vi.fn(),
    onCheck: vi.fn(),
  };
  const level = useMicLevel({ current: meter }, true, deviceId, events);
  const cleanup = capture.effect?.();
  return { meter, events, level, cleanup };
}

function tick(time: number, value: number) {
  now = time;
  volume.mockReturnValue(value);
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(time);
}

test("publishes check changes without rendering every frame and cleans up the capture", async () => {
  const { meter, events, level, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onCheck).toHaveBeenCalledWith("waiting", "mic-a"));
  for (let time = 50; time <= 300; time += 50) tick(time, 0.1);
  expect(events.onCheck.mock.calls).toEqual([
    ["waiting", "mic-a"],
    ["detected", "mic-a"],
  ]);
  expect(level.current).toBe(0.25);
  expect(meter.style.transform).toBe("scaleX(0.500)");
  tick(400, 0);
  tick(1800, 0);
  expect(events.onCheck).toHaveBeenLastCalledWith("confirmed", "mic-a");
  cleanup?.();
  expect(stop).toHaveBeenCalledOnce();
  expect(dispose).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
  expect(level.current).toBe(0);
  expect(meter.style.transform).toBe("scaleX(0)");
});

test("a capture cancelled before opening publishes no state and does not keep the microphone", async () => {
  const pending = Promise.withResolvers<{ stop: typeof stop }>();
  capture.createTrack.mockReturnValue(pending.promise);
  const { events, cleanup } = MicLevelHarness();
  cleanup?.();
  pending.resolve({ stop });
  await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
  expect(events.onCheck).not.toHaveBeenCalled();
  expect(capture.createAnalyser).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
});

test("cancelling during device enumeration stops the old capture from updating the screen", async () => {
  const pending = Promise.withResolvers<{ kind: string; deviceId: string }[]>();
  devices.mockReturnValue(pending.promise);
  const { events, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(devices).toHaveBeenCalledOnce());
  cleanup?.();
  pending.resolve([{ kind: "audioinput", deviceId: "mic-a" }]);
  await pending.promise;
  expect(events.onDevices).not.toHaveBeenCalled();
  expect(events.onCheck).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledOnce();
  expect(dispose).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

test("device changes update the list and reset a disconnected preference", async () => {
  const { events, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onDevices).toHaveBeenCalledOnce());
  devices.mockResolvedValue([{ kind: "audioinput", deviceId: "headset" }]);
  mediaDevices.dispatchEvent(new Event("devicechange"));
  await vi.waitFor(() => expect(events.onMissingDevice).toHaveBeenCalledOnce());
  expect(events.onDevices).toHaveBeenLastCalledWith([{ kind: "audioinput", deviceId: "headset" }]);
  cleanup?.();
  mediaDevices.dispatchEvent(new Event("devicechange"));
  expect(devices).toHaveBeenCalledTimes(2);
});

test("a late device enumeration cannot overwrite a newer list", async () => {
  const { events, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onDevices).toHaveBeenCalledOnce());
  const stale = Promise.withResolvers<{ kind: string; deviceId: string }[]>();
  devices.mockReturnValueOnce(stale.promise);
  mediaDevices.dispatchEvent(new Event("devicechange"));
  devices.mockResolvedValue([{ kind: "audioinput", deviceId: "headset" }]);
  mediaDevices.dispatchEvent(new Event("devicechange"));
  await vi.waitFor(() => expect(events.onMissingDevice).toHaveBeenCalledOnce());
  stale.resolve([{ kind: "audioinput", deviceId: "mic-a" }]);
  await stale.promise;
  expect(events.onDevices).toHaveBeenCalledTimes(2);
  expect(events.onDevices).toHaveBeenLastCalledWith([{ kind: "audioinput", deviceId: "headset" }]);
  cleanup?.();
});

test("an ended capture immediately clears confirmation and tests the replacement", async () => {
  const { events, meter, level, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onCheck).toHaveBeenCalledWith("waiting", "mic-a"));
  for (let time = 50; time <= 300; time += 50) tick(time, 0.1);
  tick(1800, 0);
  expect(events.onCheck).toHaveBeenLastCalledWith("confirmed", "mic-a");
  const replacement = Promise.withResolvers<ReturnType<typeof audioTrack>>();
  capture.createTrack.mockReturnValueOnce(replacement.promise);
  track.emit("ended", track);
  expect(events.onCheck).toHaveBeenLastCalledWith("starting", "mic-a");
  expect(stop).toHaveBeenCalledOnce();
  expect(dispose).toHaveBeenCalledOnce();
  expect(level.current).toBe(0);
  expect(meter.style.transform).toBe("scaleX(0)");
  expect(frames.size).toBe(0);
  expect(track.listenerCount("ended")).toBe(0);
  replacement.resolve(audioTrack("headset"));
  await vi.waitFor(() => expect(events.onCheck).toHaveBeenLastCalledWith("waiting", "headset"));
  expect(events.onDevice).toHaveBeenLastCalledWith("headset", "mic-a");
  cleanup?.();
});

test("a fallback capture reports the actual device even when the requested one is listed", async () => {
  capture.createTrack.mockResolvedValue(audioTrack("mic-b"));
  devices.mockResolvedValue([
    { kind: "audioinput", deviceId: "mic-a" },
    { kind: "audioinput", deviceId: "mic-b" },
  ]);
  const { events, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onCheck).toHaveBeenCalledWith("waiting", "mic-b"));
  expect(events.onDevice).toHaveBeenCalledWith("mic-b", "mic-a");
  expect(events.onMissingDevice).not.toHaveBeenCalled();
  cleanup?.();
});

test("an analyser initialization failure releases the already opened microphone", async () => {
  const failure = new Error("AudioContext initialization failed");
  capture.createAnalyser.mockImplementation(() => {
    throw failure;
  });
  const { events, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onError).toHaveBeenCalledWith(failure));
  expect(stop).toHaveBeenCalledOnce();
  expect(track.listenerCount("ended")).toBe(0);
  expect(frames.size).toBe(0);
  cleanup?.();
  expect(stop).toHaveBeenCalledOnce();
});

test("a device enumeration failure also releases the analyser and microphone", async () => {
  const failure = new Error("Device enumeration failed");
  devices.mockRejectedValueOnce(failure);
  const { events, cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(events.onError).toHaveBeenCalledWith(failure));
  expect(stop).toHaveBeenCalledOnce();
  expect(dispose).toHaveBeenCalledOnce();
  expect(events.onCheck).not.toHaveBeenCalledWith("waiting", "mic-a");
  expect(frames.size).toBe(0);
  cleanup?.();
});

test("the capture asks for the clean-up the call uses", async () => {
  const { cleanup } = MicLevelHarness();
  await vi.waitFor(() => expect(capture.createTrack).toHaveBeenCalled());
  expect(capture.createTrack).toHaveBeenCalledWith({
    deviceId: "mic-a",
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  });
  if (typeof cleanup === "function") cleanup();
});
