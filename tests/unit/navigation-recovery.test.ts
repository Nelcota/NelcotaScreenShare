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
    rememberPendingNavigation(store, {
      href: "/admin/salas?status=ativa",
      from: "/admin",
      now: 1_000,
    });
    expect(recoveredTarget(store, { current: "/admin", now: 3_000 })).toBe(
      "/admin/salas?status=ativa",
    );
    // Only once: the next load does nothing.
    expect(recoveredTarget(store, { current: "/admin", now: 3_500 })).toBeNull();
  });

  test("an old target, the same page or a finished navigation do nothing", () => {
    const store = memoryStore();
    const pending = { href: "/admin/salas", from: "/admin", now: 1_000 };
    rememberPendingNavigation(store, pending);
    expect(recoveredTarget(store, { current: "/admin", now: 60_000 })).toBeNull();
    rememberPendingNavigation(store, pending);
    expect(recoveredTarget(store, { current: "/admin/salas", now: 2_000 })).toBeNull();
    rememberPendingNavigation(store, pending);
    forgetPendingNavigation(store);
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
  });

  test("going somewhere else meanwhile is not an interrupted navigation", () => {
    const store = memoryStore();
    // A navigation to /admin was still loading when the person typed another address.
    rememberPendingNavigation(store, {
      href: "/admin",
      from: "/admin/conta/seguranca",
      now: 1_000,
    });
    expect(recoveredTarget(store, { current: "/admin/salas", now: 2_000 })).toBeNull();
  });

  test("a link to a server endpoint or a file is never resumed", () => {
    const store = memoryStore();
    // "Confirmar e-mail" leads to the endpoint, which redirects to /conta: going on to the
    // link again would spend the token twice.
    rememberPendingNavigation(store, {
      href: "/api/auth/verify-email?token=abc&callbackURL=%2Fconta",
      from: "/conta?aviso=email",
      now: 1_000,
    });
    expect(recoveredTarget(store, { current: "/conta?aviso=email", now: 2_000 })).toBeNull();
    store.setItem(
      "nelcota:pending-navigation",
      JSON.stringify({ href: "/api/conta/dados", from: "/conta", at: 1_000 }),
    );
    expect(recoveredTarget(store, { current: "/conta", now: 2_000 })).toBeNull();
    rememberPendingNavigation(store, { href: "/robots.txt", from: "/", now: 1_000 });
    expect(recoveredTarget(store, { current: "/", now: 2_000 })).toBeNull();
  });

  test("never leaves the app, and ignores a broken value", () => {
    const store = memoryStore();
    rememberPendingNavigation(store, { href: "//outro.exemplo/x", from: "/admin", now: 1_000 });
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
    store.setItem("nelcota:pending-navigation", "{quebrado");
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
    store.setItem(
      "nelcota:pending-navigation",
      JSON.stringify({ href: "/admin/salas", at: 1_000 }),
    );
    expect(recoveredTarget(store, { current: "/admin", now: 2_000 })).toBeNull();
  });
});
