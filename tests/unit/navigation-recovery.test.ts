import { describe, expect, test } from "vitest";
import {
  forgetPendingNavigation,
  recoveredTarget,
  rememberPendingNavigation,
} from "@/lib/navigation-recovery";

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("resuming a navigation after a forced reload", () => {
  test("loading the old page again right after a click goes on to the clicked page", () => {
    const store = memoryStore();
    rememberPendingNavigation(store, "/admin/salas?status=ativa", 1_000);
    expect(recoveredTarget(store, { current: "/admin", now: 3_000 })).toBe(
      "/admin/salas?status=ativa",
    );
    // Only once: the next load does nothing.
    expect(recoveredTarget(store, { current: "/admin", now: 3_500 })).toBeNull();
  });

  test("an old target, the same page or a finished navigation do nothing", () => {
    const store = memoryStore();
    rememberPendingNavigation(store, "/admin/salas", 1_000);
    expect(recoveredTarget(store, { current: "/admin", now: 60_000 })).toBeNull();
    rememberPendingNavigation(store, "/admin/salas", 1_000);
    expect(recoveredTarget(store, { current: "/admin/salas", now: 2_000 })).toBeNull();
    rememberPendingNavigation(store, "/admin/salas", 1_000);
    forgetPendingNavigation(store);
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
  });

  test("never leaves the app, and ignores a broken value", () => {
    const store = memoryStore();
    rememberPendingNavigation(store, "//outro.exemplo/x", 1_000);
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
    store.setItem("nelcota:pending-navigation", "{quebrado");
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
  });
});
