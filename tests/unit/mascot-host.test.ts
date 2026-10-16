import { afterEach, expect, test, vi } from "vitest";
import { createHostMotions } from "@/features/mascot/client/host-motions";
import { HOST_HOP, NOD, SETTLE } from "@/features/mascot/domain/body-motions";
import { avatarFrame } from "@/features/mascot/domain/avatar-frames";
import type { Expression } from "@/features/mascot/domain/face";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture() {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  const dataset: DOMStringMap = {};
  const hands = { wave: vi.fn(), hold: vi.fn(), cancel: vi.fn() };
  const move = vi.fn();
  let available = true;
  let presenting = false;
  let expression: Expression | undefined;
  const host = createHostMotions({
    root: { dataset } as unknown as HTMLElement,
    hands,
    move,
    stopMotion: vi.fn(),
    react: (next) => {
      expression = next;
    },
    available: () => available,
    presenting: () => presenting,
  });
  return {
    host,
    hands,
    dataset,
    move,
    get expression() {
      return expression;
    },
    share() {
      presenting = true;
      host.present();
    },
    block() {
      available = false;
    },
  };
}

test("a welcome starts politely, lets out one small hop and returns to rest", () => {
  const f = fixture();
  f.host.welcome();
  expect(f.expression).toBe("welcoming");
  expect(f.hands.wave).toHaveBeenCalledOnce();
  expect(f.move).not.toHaveBeenCalled();
  vi.advanceTimersByTime(650);
  expect(f.move).toHaveBeenCalledExactlyOnceWith(HOST_HOP);
  vi.advanceTimersByTime(850);
  expect(f.expression).toBeUndefined();
  expect(f.dataset.hostGesture).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

test("a burst of arrivals does not restart the greeting or queue more greetings", () => {
  const f = fixture();
  f.host.welcome();
  vi.advanceTimersByTime(700);
  f.host.welcome();
  vi.advanceTimersByTime(4300);
  expect(f.hands.wave).toHaveBeenCalledOnce();
  expect(f.move).toHaveBeenCalledOnce();
  f.host.welcome();
  expect(f.hands.wave).toHaveBeenCalledTimes(2);
  f.host.cancel();
});

test("sharing interrupts a welcome and lowers the hand before settling into attention", () => {
  const f = fixture();
  f.host.welcome();
  f.share();
  expect(f.expression).toBeUndefined();
  expect(f.hands.hold).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(650);
  expect(f.move).toHaveBeenCalledExactlyOnceWith(SETTLE);
  vi.advanceTimersByTime(1000);
  expect(f.host.active).toBe(false);
  expect(avatarFrame("presenting")).toEqual(avatarFrame("neutral"));
  expect(vi.getTimerCount()).toBe(0);
});

test("arrivals during a presentation get a quiet nod while the stage keeps attention", () => {
  const f = fixture();
  f.share();
  f.host.welcome();
  expect(f.dataset.hostGesture).toBe("quiet-welcome");
  expect(f.move).toHaveBeenCalledExactlyOnceWith(NOD);
  expect(f.expression).toBeUndefined();
  expect(f.hands.wave).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000);
  expect(f.move).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

test("hidden or reduced-motion contexts skip the routines and cancel delayed steps", () => {
  const f = fixture();
  f.host.welcome();
  f.block();
  vi.advanceTimersByTime(2000);
  expect(f.move).not.toHaveBeenCalled();
  expect(f.host.active).toBe(false);
  f.host.welcome();
  f.share();
  expect(f.hands.wave).toHaveBeenCalledOnce();
  expect(f.hands.hold).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test("disposal cancels an unfinished greeting without a late hop", () => {
  const f = fixture();
  f.host.welcome();
  f.host.cancel();
  vi.advanceTimersByTime(10_000);
  expect(f.move).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
