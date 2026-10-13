/**
 * Joins nudges that arrive close together into one reload: accepting a request nudges
 * "friends" and "status" at once, and two tabs can change the same thing.
 */
export function createNudgeBatcher(run: () => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function nudge() {
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      run();
    }, delayMs);
  }

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }

  /** Reloads right away, taking any waiting reload with it: a ring must not wait. */
  function now() {
    cancel();
    run();
  }

  return { nudge, now, cancel };
}
