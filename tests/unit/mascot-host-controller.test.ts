import { afterEach, expect, test, vi } from "vitest";
import { createMascotController } from "@/features/mascot/client/mascot-controller";
import type { MascotActivity } from "@/features/mascot/domain/personality";
import { HOST_HOP, SETTLE } from "@/features/mascot/domain/body-motions";

vi.mock("@/features/mascot/client/page-input", () => ({ subscribePageInput: () => () => {} }));
vi.mock("@/features/mascot/client/ambient", () => ({ startAmbient: () => () => {} }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture() {
  vi.useFakeTimers();
  let activity: MascotActivity = "waiting";
  let observe: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  const preference = { matches: false };
  const doc = { hidden: false, activeElement: null, querySelector: () => null };
  class Field {
    type = "text";
  }
  for (const type of [
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLButtonElement",
    "HTMLAnchorElement",
  ]) {
    vi.stubGlobal(type, Field);
  }
  vi.stubGlobal("window", { matchMedia: () => preference, setTimeout, clearTimeout });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: NonNullable<typeof observe>) {
        observe = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const sprite = { animate: vi.fn(() => ({ cancel: vi.fn(), playState: "running" })) };
  const root = {
    dataset: {} as DOMStringMap,
    style: { setProperty: vi.fn() },
    querySelector: () => sprite,
    querySelectorAll: () => [],
    closest: () => null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getAnimations: () => [],
    animate: vi.fn(() => ({ cancel: vi.fn() })),
  };
  const face = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 80 }),
    closest: () => null,
  };
  const controller = createMascotController(
    root as unknown as HTMLElement,
    face as unknown as HTMLElement,
    { lids: [], render: vi.fn() },
    { base: () => "neutral", canSleep: () => false, activity: () => activity, voice: () => 0 },
  );
  return {
    root,
    sprite,
    controller,
    doc,
    preference,
    visible(value: boolean) {
      observe?.([{ isIntersecting: value }]);
    },
    activity(next: MascotActivity) {
      activity = next;
      controller.syncContext();
    },
  };
}

test("the first arrival greets when the previously hidden corner becomes visible", () => {
  const f = fixture();
  f.visible(false);
  f.activity("idle");
  f.controller.welcome();
  expect(f.root.dataset.hostGesture).toBeUndefined();
  f.visible(true);
  expect(f.root.dataset.hostGesture).toBe("welcome");
  vi.advanceTimersByTime(1600);
  expect(f.root.animate).toHaveBeenCalledWith(HOST_HOP.keyframes, HOST_HOP.options);
  expect(f.root.dataset.expression).toBe("neutral");
  f.controller.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

test("repeated context updates do not raise the hand again after the sharing introduction", () => {
  const f = fixture();
  f.activity("presenting");
  vi.advanceTimersByTime(2000);
  f.controller.syncContext();
  f.controller.update();
  expect(f.sprite.animate).toHaveBeenCalledOnce();
  expect(f.root.animate).toHaveBeenCalledExactlyOnceWith(SETTLE.keyframes, SETTLE.options);
  expect(f.root.dataset.expression).toBe("presenting");
  expect(f.root.dataset.hostGesture).toBeUndefined();
  f.controller.dispose();
});

test("the first share introduces the stage after revealing the corner mascot", () => {
  const f = fixture();
  f.visible(false);
  f.activity("presenting");
  expect(f.root.dataset.hostGesture).toBeUndefined();
  f.visible(true);
  expect(f.root.dataset.hostGesture).toBe("presenting");
  vi.advanceTimersByTime(2000);
  expect(f.root.dataset.expression).toBe("presenting");
  expect(f.root.dataset.hostGesture).toBeUndefined();
  f.controller.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

test("hidden-tab arrivals and stale hidden-corner arrivals are not replayed", () => {
  const f = fixture();
  f.activity("idle");
  f.doc.hidden = true;
  f.controller.welcome();
  f.doc.hidden = false;
  f.visible(true);
  expect(f.root.dataset.hostGesture).toBeUndefined();
  f.visible(false);
  f.controller.welcome();
  vi.advanceTimersByTime(2000);
  f.visible(true);
  expect(f.root.dataset.hostGesture).toBeUndefined();
  f.controller.dispose();
});

test("reduced motion skips welcomes and sharing gestures but keeps the attentive expression", () => {
  const f = fixture();
  f.preference.matches = true;
  f.activity("presenting");
  f.controller.welcome();
  expect(f.root.animate).not.toHaveBeenCalled();
  expect(f.sprite.animate).not.toHaveBeenCalled();
  expect(f.root.dataset.expression).toBe("presenting");
  f.controller.dispose();
  expect(vi.getTimerCount()).toBe(0);
});
