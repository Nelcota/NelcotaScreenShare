import { HOST_HOP, NOD, SETTLE, type Motion } from "@/features/mascot/domain/body-motions";
import type { Expression } from "@/features/mascot/domain/face";
import type { createHandMotions } from "./hand-motions";

interface HostOptions {
  root: HTMLElement;
  hands: ReturnType<typeof createHandMotions>;
  react(expression: Expression | undefined): void;
  move(motion: Motion): unknown;
  stopMotion(): void;
  available(): boolean;
  presenting(): boolean;
}

/** A polite host: brief welcomes, then quiet attention while a screen is shared. */
export function createHostMotions(options: HostOptions) {
  const { root, hands } = options;
  const timers = new Set<number>();
  let active = false;
  let nextWelcomeAt = 0;

  function cancel() {
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
    if (!active) return;
    active = false;
    delete root.dataset.hostGesture;
    hands.cancel();
    options.stopMotion();
    options.react(undefined);
  }

  function later(delay: number, callback: () => void) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!options.available()) {
        cancel();
        return;
      }
      callback();
    }, delay);
    timers.add(timer);
  }

  function begin(gesture: string) {
    cancel();
    active = true;
    root.dataset.hostGesture = gesture;
  }

  return {
    get active() {
      return active;
    },
    cancel,
    welcome() {
      if (!options.available() || performance.now() < nextWelcomeAt) return;
      nextWelcomeAt = performance.now() + 5000;
      if (options.presenting()) {
        begin("quiet-welcome");
        options.move(NOD);
        later(600, cancel);
        return;
      }
      begin("welcome");
      options.react("welcoming");
      hands.wave();
      // Tries to stay composed, then lets a small hop of excitement escape.
      later(650, () => options.move(HOST_HOP));
      later(1500, cancel);
    },
    present() {
      if (!options.available()) return;
      begin("presenting");
      hands.hold();
      later(650, () => {
        hands.cancel();
        options.move(SETTLE);
      });
      later(1650, cancel);
    },
  };
}
