import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { savedShareProfile, saveShareProfile } from "@/features/room/client/saved-share-profile";

const storage = { getItem: vi.fn(), setItem: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => vi.unstubAllGlobals());

test("the versioned profile preference is saved without unrelated browser settings", () => {
  saveShareProfile("text");
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith("nelcota:share-profile:v1", "text");
  storage.getItem.mockReturnValue("text");
  expect(savedShareProfile()).toBe("text");
});

test("invalid or missing storage falls back to automatic", () => {
  storage.getItem.mockReturnValue("obsolete-preset");
  expect(savedShareProfile()).toBe("automatic");
  storage.getItem.mockReturnValue(null);
  expect(savedShareProfile()).toBe("automatic");
});

test("blocked browser storage does not prevent capture or preference changes", () => {
  storage.getItem.mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  storage.setItem.mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  expect(savedShareProfile()).toBe("automatic");
  expect(() => saveShareProfile("video")).not.toThrow();
});
