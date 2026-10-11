import { afterEach, beforeEach, expect, test, vi } from "vitest";

const telemetry = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: telemetry.warning }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

test("invalid saved preferences fall back to a safe default and changes notify subscribers", async () => {
  const target = new EventTarget();
  const values = new Map<string, string>();
  vi.stubGlobal(
    "window",
    Object.assign(target, {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? "unexpected",
        setItem: (key: string, value: string) => values.set(key, value),
      },
    }),
  );
  const sound = await import("@/features/room/domain/chat-notification-sound");
  const changed = vi.fn();
  const unsubscribe = sound.subscribeChatSound(changed);
  expect(sound.currentChatSound()).toBe("soft");
  sound.setChatSound("off");
  expect(sound.currentChatSound()).toBe("off");
  expect(changed).toHaveBeenCalledTimes(1);
  unsubscribe();
  sound.setChatSound("chime");
  expect(changed).toHaveBeenCalledTimes(1);
});

test("blocked browser storage keeps the preference for this session and reports the problem once", async () => {
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      localStorage: {
        getItem: () => {
          throw new Error("Storage blocked");
        },
        setItem: () => {
          throw new Error("Storage blocked");
        },
      },
    }),
  );
  const sound = await import("@/features/room/domain/chat-notification-sound");
  expect(sound.currentChatSound()).toBe("soft");
  sound.setChatSound("off");
  expect(sound.currentChatSound()).toBe("off");
  expect(telemetry.warning).toHaveBeenCalledTimes(1);
});

test("muting never creates audio and a blocked audio context fails without breaking chat", async () => {
  const constructor = vi.fn(function () {
    throw new Error("Audio unavailable");
  });
  vi.stubGlobal("AudioContext", constructor);
  const { playChatNotification } = await import("@/features/room/audio/chat-notification");
  expect(await playChatNotification("off")).toBe(false);
  expect(constructor).not.toHaveBeenCalled();
  expect(await playChatNotification("soft")).toBe(false);
  expect(constructor).not.toHaveBeenCalled();
  expect(await playChatNotification("soft", true)).toBe(false);
  expect(telemetry.warning).toHaveBeenCalledTimes(1);
});

test("unsupported audio stays silent without throwing", async () => {
  vi.stubGlobal("AudioContext", undefined);
  const { playChatNotification } = await import("@/features/room/audio/chat-notification");
  expect(await playChatNotification("chime")).toBe(false);
});

test("resumes audio, plays the selected pattern and releases each finished sound", async () => {
  class SoundNode extends EventTarget {
    type = "sine";
    frequency = { setValueAtTime: vi.fn() };
    connect = vi.fn();
    disconnect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
  }
  const notes: SoundNode[] = [];
  const volumes: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state: "suspended",
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    createOscillator: () => {
      const note = new SoundNode();
      notes.push(note);
      return note;
    },
    createGain: () => {
      const volume = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      volumes.push(volume);
      return volume;
    },
  };
  const constructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal("AudioContext", constructor);
  const { playChatNotification } = await import("@/features/room/audio/chat-notification");
  expect(await playChatNotification("chime")).toBe(false);
  expect(constructor).not.toHaveBeenCalled();
  expect(await playChatNotification("chime", true)).toBe(true);
  expect(context.resume).toHaveBeenCalledTimes(1);
  expect(notes).toHaveLength(2);
  for (const note of notes) {
    const start = Number(note.start.mock.calls[0]?.[0]);
    const stop = Number(note.stop.mock.calls[0]?.[0]);
    expect(start).toBeGreaterThanOrEqual(context.currentTime);
    expect(stop).toBeGreaterThan(start);
    note.dispatchEvent(new Event("ended"));
    expect(note.disconnect).toHaveBeenCalledTimes(1);
  }
  expect(volumes.every((volume) => volume.disconnect.mock.calls.length === 1)).toBe(true);
  expect(await playChatNotification("soft")).toBe(true);
  expect(notes).toHaveLength(3);
  expect(constructor).toHaveBeenCalledTimes(1);
  expect(await playChatNotification("off")).toBe(false);
  expect(notes).toHaveLength(3);
  context.state = "suspended";
  expect(await playChatNotification("chime")).toBe(false);
  expect(await playChatNotification("chime")).toBe(false);
  expect(context.resume).toHaveBeenCalledTimes(1);
  expect(notes).toHaveLength(3);
  expect(await playChatNotification("soft", true)).toBe(true);
  expect(notes).toHaveLength(4);
  expect(context.resume).toHaveBeenCalledTimes(2);
});

test("the first gesture unlocks audio once, unless notifications are muted", async () => {
  const context = {
    state: "suspended",
    resume: vi.fn(async () => {
      context.state = "running";
    }),
  };
  const constructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal("AudioContext", constructor);
  const { unlockChatAudio } = await import("@/features/room/audio/chat-notification");
  await unlockChatAudio("off");
  expect(constructor).not.toHaveBeenCalled();
  await unlockChatAudio("soft");
  await unlockChatAudio("soft");
  expect(constructor).toHaveBeenCalledTimes(1);
  expect(context.resume).toHaveBeenCalledTimes(1);
});
