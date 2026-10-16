import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createNudgeBatcher } from "@/features/live/client/nudge-batcher";

describe("nudge batcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("nudges close together reload once", () => {
    const run = vi.fn();
    const batcher = createNudgeBatcher(run, 300);
    batcher.nudge();
    batcher.nudge();
    vi.advanceTimersByTime(299);
    batcher.nudge();
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledOnce();
    batcher.nudge();
    vi.advanceTimersByTime(300);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test("now reloads at once and takes the waiting reload with it", () => {
    const run = vi.fn();
    const batcher = createNudgeBatcher(run, 300);
    batcher.nudge();
    batcher.now();
    expect(run).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_000);
    expect(run).toHaveBeenCalledOnce();
  });

  test("cancel drops a pending reload", () => {
    const run = vi.fn();
    const batcher = createNudgeBatcher(run, 300);
    batcher.nudge();
    batcher.cancel();
    vi.advanceTimersByTime(1_000);
    expect(run).not.toHaveBeenCalled();
  });
});
