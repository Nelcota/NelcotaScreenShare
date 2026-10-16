import { describe, expect, test } from "vitest";
import { createPairMotion } from "@/features/mascot/domain/pair-motion";
import { nextPairRest, PAIR_STEP_MS } from "@/features/mascot/domain/pair";

function approaching() {
  const motion = createPairMotion(() => 0);
  motion.resize({ width: 672, size: 128 });
  motion.advance(6000, true);
  motion.advance(PAIR_STEP_MS.invite, true);
  motion.advance(PAIR_STEP_MS.answer, true);
  return motion;
}

describe("synchronized pair movement", () => {
  test("resizing a resting pair keeps both characters inside the new scene", () => {
    const motion = createPairMotion(() => 0);
    motion.resize({ width: 672, size: 128 });
    motion.suspend(true);
    motion.resize({ width: 343, size: 112 });
    expect(motion.state.visitor).toBeGreaterThanOrEqual(56);
    expect(motion.state.resident).toBeLessThanOrEqual(343 - 56);
    expect(motion.state.phase).toBe("rest");
  });

  test("rest varies between six and ten seconds and respects busy fields", () => {
    expect(nextPairRest(0)).toBe(6000);
    expect(nextPairRest(1)).toBe(10000);
    const motion = createPairMotion(() => 0.5);
    motion.resize({ width: 672, size: 128 });
    motion.advance(7999, true);
    expect(motion.state.phase).toBe("rest");
    motion.advance(1, false);
    expect(motion.state.phase).toBe("rest");
    motion.advance(100, true);
    expect(motion.state.phase).toBe("invite");
  });

  test("the curious partner invites first and waits for the calm partner's answer", () => {
    const motion = createPairMotion(() => 0);
    motion.resize({ width: 672, size: 128 });
    const home = motion.state;
    motion.advance(6000, true);
    expect(motion.state.phase).toBe("invite");
    motion.advance(PAIR_STEP_MS.invite - 1, true);
    expect(motion.state.visitor).toBe(home.visitor);
    expect(motion.state.resident).toBe(home.resident);
    motion.advance(1, true);
    expect(motion.state.phase).toBe("answer");
    motion.advance(PAIR_STEP_MS.answer, true);
    expect(motion.state.phase).toBe("approach");
    motion.advance(1000, true);
    expect(motion.state.visitor - home.visitor).toBeGreaterThan(
      home.resident - motion.state.resident,
    );
  });

  test("only gets ready for the greeting when both arrive", () => {
    const motion = approaching();
    motion.advance(1000, true);
    expect(motion.state.phase).toBe("approach");
    motion.advance(PAIR_STEP_MS.walk, true);
    expect(motion.state.phase).toBe("ready");
    expect(motion.state.visitor).toBeCloseTo(672 / 2 - 128 * 0.43);
    expect(motion.state.resident).toBeCloseTo(672 / 2 + 128 * 0.43);
  });

  test("resizing near arrival keeps the position and waits for the new target", () => {
    const motion = approaching();
    motion.advance(2900, true);
    const before = motion.state;
    motion.resize({ width: 1000, size: 128 });
    expect(motion.state.visitor).toBe(before.visitor);
    expect(motion.state.resident).toBe(before.resident);
    motion.advance(300, true);
    expect(motion.state.phase).toBe("approach");
    motion.advance(5000, true);
    expect(motion.state.phase).toBe("ready");
    expect(motion.state.visitor).toBeCloseTo(1000 / 2 - 128 * 0.43);
    expect(motion.state.resident).toBeCloseTo(1000 / 2 + 128 * 0.43);
  });

  test("a new size during the ready phase requires arriving again before the high five", () => {
    const motion = approaching();
    motion.advance(4000, true);
    motion.advance(400, true);
    motion.resize({ width: 1000, size: 128 });
    expect(motion.state.phase).toBe("approach");
    motion.advance(50, true);
    expect(motion.state.phase).toBe("approach");
  });

  test("pausing the walk keeps the position and does not consume the remaining movement", () => {
    const motion = approaching();
    motion.advance(1000, true);
    motion.suspend(true);
    const frozen = motion.state;
    motion.advance(60_000, true);
    expect(motion.state).toEqual(frozen);
    motion.suspend(false);
    motion.advance(100, true);
    expect(motion.state.phase).toBe("approach");
    expect(motion.state.visitor).toBeGreaterThan(frozen.visitor);
    expect(motion.state.visitor - frozen.visitor).toBeLessThan(10);
  });

  test("pausing the ready phase also preserves the greeting deadline", () => {
    const motion = approaching();
    motion.advance(4000, true);
    motion.advance(200, true);
    motion.suspend(true);
    motion.advance(60_000, true);
    motion.suspend(false);
    motion.advance(249, true);
    expect(motion.state.phase).toBe("ready");
    motion.advance(1, true);
    expect(motion.state.phase).toBe("hit");
  });

  test("interrupting starts from the current position and does not overshoot the rest spot", () => {
    const motion = approaching();
    motion.advance(800, true);
    const before = motion.state;
    motion.retreat();
    expect(motion.state.visitor).toBe(before.visitor);
    expect(motion.state.resident).toBe(before.resident);
    motion.advance(100, true);
    expect(motion.state.visitor).toBeLessThan(before.visitor);
    motion.advance(10_000, true);
    expect(motion.state.phase).toBe("rest");
    expect(motion.state.visitor).toBeCloseTo(672 * 0.16);
    motion.advance(5999, true);
    expect(motion.state.phase).toBe("rest");
  });

  test("high five, cheer and return complete an encounter without jumps or extra cycles", () => {
    const motion = approaching();
    motion.advance(4000, true);
    motion.advance(PAIR_STEP_MS.ready, true);
    expect(motion.state.phase).toBe("hit");
    motion.advance(180, true);
    expect(motion.state.phase).toBe("hit");
    expect(motion.state.visitor).toBeCloseTo(672 / 2 - 128 * 0.39);
    motion.advance(PAIR_STEP_MS.hit - 180, true);
    expect(motion.state.phase).toBe("cheer");
    motion.advance(PAIR_STEP_MS.cheer, true);
    expect(motion.state.phase).toBe("return");
    motion.advance(PAIR_STEP_MS.walk, true);
    expect(motion.state.phase).toBe("rest");
    motion.advance(6000, true);
    expect(motion.state.phase).toBe("invite");
  });
});
