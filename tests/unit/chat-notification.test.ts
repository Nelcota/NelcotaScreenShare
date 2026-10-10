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
  expect(telemetry.warning).toHaveBeenCalledTimes(1);
});

test("unsupported audio stays silent without throwing", async () => {
  vi.stubGlobal("AudioContext", undefined);
  const { playChatNotification } = await import("@/features/room/audio/chat-notification");
  expect(await playChatNotification("chime")).toBe(false);
});
