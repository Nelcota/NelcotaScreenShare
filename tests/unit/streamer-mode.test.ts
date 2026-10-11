import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: vi.fn() }));
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

test.each([
  ["1", true],
  ["0", false],
  ["true", false],
  ["yes", false],
  [null, false],
])("only accepts saved 1/0: %s", async (saved, expected) => {
  vi.stubGlobal("window", { localStorage: { getItem: () => saved } });
  const { currentStreamerMode } = await import("@/features/room/hooks/use-streamer-mode");
  expect(currentStreamerMode()).toBe(expected);
});

test("blocked storage preserves the session choice and unsubscribes cleanly", async () => {
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    }),
  );
  const preferences = await import("@/features/room/hooks/use-streamer-mode");
  const changed = vi.fn();
  const unsubscribe = preferences.subscribeStreamerMode(changed);
  preferences.setStreamerMode(true);
  expect(preferences.currentStreamerMode()).toBe(true);
  expect(changed).toHaveBeenCalledOnce();
  unsubscribe();
  preferences.setStreamerMode(false);
  expect(preferences.currentStreamerMode()).toBe(false);
  expect(changed).toHaveBeenCalledOnce();
});
