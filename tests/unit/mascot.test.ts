import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { createHandMotions } from "@/features/mascot/client/hand-motions";
import { avatarFrame } from "@/features/mascot/domain/avatar-frames";
import {
  EYE_SHAPES,
  eyelidOffset,
  gazeAt,
  IDLE,
  POSE_EYES,
  pupilOffset,
} from "@/features/mascot/domain/eye-tracking";
import { EXPRESSIONS, toFaceState } from "@/features/mascot/domain/face";
import { createReasons } from "@/features/mascot/domain/reasons";
import { idleSleep } from "@/features/mascot/domain/sleep";
import { springStep } from "@/features/mascot/domain/spring";

test("the eyelid curve and stroke stay completely outside the open eye", () => {
  for (const { ry } of EYE_SHAPES) {
    const lowestStrokeEdge = eyelidOffset(ry, 0) + ry + 5 + 2.5 / 2;
    assert.ok(lowestStrokeEdge < -ry, "no part of the stroke may enter the clip");
    assert.equal(eyelidOffset(ry, 1), 0);
    assert.ok(eyelidOffset(ry, 0.6) > eyelidOffset(ry, 0));
  }
});

test("both eyes converge on the cursor near the face and keep responding at a distance", () => {
  const bounds = { left: 100, top: 50, width: 512, height: 512 };
  const left = POSE_EYES[0][0];
  const right = POSE_EYES[0][1];
  const midpoint = {
    x: bounds.left + (left.x + right.x) / 2,
    y: bounds.top + (left.y + right.y) / 2,
  };
  const near = gazeAt(bounds, midpoint);
  assert.ok(
    near.leftX > 0 && near.rightX < 0,
    "each eye aims at the same cursor instead of copying the other",
  );
  const overLeftEye = gazeAt(bounds, { x: bounds.left + left.x, y: bounds.top + left.y });
  assert.equal(overLeftEye.leftX, 0);
  assert.equal(overLeftEye.leftY, 0);
  const far = gazeAt(bounds, { x: midpoint.x + 400, y: midpoint.y });
  const farther = gazeAt(bounds, { x: midpoint.x + 800, y: midpoint.y });
  assert.ok(farther.leftX > far.leftX, "the gaze does not freeze after 140 pixels");
  assert.ok(Math.hypot(farther.leftX, farther.leftY) < 1);
});

test.for([-15, -9, -7, 0, 5, 9, 15])(
  "the pupils stay inside the eyes in any direction and expression at a %i° tilt",
  (tilt) => {
    for (const eye of EYE_SHAPES) {
      for (const scale of [0.68, 1, 1.05]) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
          const offset = pupilOffset({ x: Math.cos(angle), y: Math.sin(angle) }, eye, scale, tilt);
          for (let edge = 0; edge < Math.PI * 2; edge += Math.PI / 12) {
            const x = offset.x + Math.cos(edge) * eye.pupilRx * scale;
            const y = offset.y + Math.sin(edge) * eye.pupilRy * scale;
            assert.ok(
              (x / eye.rx) ** 2 + (y / eye.ry) ** 2 < 1,
              "the pupil edge must not be clipped",
            );
          }
        }
      }
    }
  },
);

test("a fast gaze stays continuous through reversals even at 30 frames per second", () => {
  const gaze = { ...IDLE };
  const velocity = { ...IDLE };
  const bounds = { left: 0, top: 0, width: 208, height: 208 };
  for (let frame = 0; frame < 120; frame++) {
    const target = gazeAt(bounds, { x: frame % 8 < 4 ? -500 : 800, y: frame % 6 < 3 ? -500 : 800 });
    springStep(gaze, velocity, target, 0.14, 1 / 30);
    for (const value of Object.values(gaze))
      assert.ok(Number.isFinite(value) && Math.abs(value) <= 1);
  }
});

test("the avatar closes its eyes during password entry, even while celebrating", () => {
  assert.deepEqual(avatarFrame("celebrate", 1, 1), { column: 0, row: 1 });
  assert.deepEqual(avatarFrame("celebrate", 0, 0), { column: 1, row: 0 });
  assert.deepEqual(avatarFrame("worried", 0, 0), { column: 1, row: 1 });
  assert.deepEqual(avatarFrame(undefined), { column: 0, row: 0 });
});

test("an error replaces an active celebration, which returns when the error ends", () => {
  const reasons = createReasons(() => 0);
  reasons.set("celebrate", "celebrate", 1600);
  reasons.set("error", "grumpy", 4000);
  assert.equal(reasons.current("neutral"), "grumpy");
  reasons.delete("error");
  assert.equal(reasons.current("neutral"), "celebrate");
});

test("the typing reaction lasts until its deadline", () => {
  let time = 0;
  const reasons = createReasons(() => time);
  reasons.set("typing", "happy", 2000);
  assert.equal(reasons.current("neutral"), "happy");
  time = 2000;
  assert.equal(reasons.current("neutral"), "neutral");
  assert.equal(reasons.nextExpiry(), Infinity);
});

test("waking up removes sleep even before its expression finishes", () => {
  const reasons = createReasons(() => 0);
  reasons.set("sleep", "asleep");
  assert.equal(reasons.current("neutral"), "asleep");
  reasons.delete("sleep");
  assert.equal(reasons.current("neutral"), "neutral");
  const value = toFaceState(EXPRESSIONS.asleep);
  const target = toFaceState(EXPRESSIONS.neutral);
  const velocity = {
    tilt: 0,
    pupil: 0,
    lid0: 0,
    lid1: 0,
    rest: 0,
  };
  for (let frame = 0; frame < 12; frame++) springStep(value, velocity, target, 0.32, 1 / 30);
  assert.ok(value.lid0 < 0.02, "the eyes reopen in under half a second");
  assert.ok(value.lid1 < 0.02);
  assert.ok(value.rest < 0.02, "the body also gets up when waking");
});

test("sleep considers the most recent activity, even with late timers", () => {
  assert.deepEqual(idleSleep(0, 29_999), { expression: null, nextIn: 1 });
  assert.deepEqual(idleSleep(0, 30_000), { expression: "sleepy", nextIn: 15_000 });
  assert.deepEqual(idleSleep(0, 45_000), { expression: "asleep", nextIn: Infinity });
  assert.equal(idleSleep(0, 90_000).expression, "asleep");
  assert.deepEqual(idleSleep(29_500, 30_000), { expression: null, nextIn: 29_500 });
  assert.deepEqual(idleSleep(44_900, 45_000), { expression: null, nextIn: 29_900 });
});

test("a nap replaces a persistent notice and waking up restores that notice", () => {
  const reasons = createReasons(() => 0);
  reasons.set("capsLock", "surprised");
  reasons.set("sleep", "sleepy");
  assert.equal(reasons.current("neutral"), "sleepy");
  reasons.set("sleep", "asleep");
  assert.equal(reasons.current("neutral"), "asleep");
  reasons.delete("sleep");
  assert.equal(reasons.current("neutral"), "surprised");
});

test("drowsiness keeps the eyes partly open and comes before the sleeping posture", () => {
  assert.deepEqual(avatarFrame("sleepy", 0.6, 0.6), avatarFrame("neutral"));
  assert.notDeepEqual(avatarFrame("asleep", 1, 1), avatarFrame("sleepy", 0.6, 0.6));
  const value = toFaceState(EXPRESSIONS.neutral);
  const velocity = Object.fromEntries(Object.keys(value).map((key) => [key, 0]));
  for (const target of [EXPRESSIONS.sleepy, EXPRESSIONS.asleep, EXPRESSIONS.neutral]) {
    for (let frame = 0; frame < 90; frame++)
      springStep(value, velocity, toFaceState(target), 0.85, 1 / 30);
    assert.ok(Math.abs(value.rest - target.rest) < 0.002);
    assert.ok(Math.abs(value.lid0 - target.lid) < 0.002);
  }
});

test("springs are capped at 30fps and do not blow up when the target changes quickly", () => {
  const value = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  for (let frame = 0; frame < 120; frame++) {
    const target = { x: frame % 8 < 4 ? -1 : 1, y: frame % 8 < 4 ? 1 : -1 };
    springStep(value, velocity, target, 0.2, 1 / 30);
    assert.ok(Number.isFinite(value.x) && Number.isFinite(value.y));
    assert.ok(Math.abs(value.x) <= 1 && Math.abs(value.y) <= 1);
  }
});

test("a password closes both eyes and showing the password allows peeking", () => {
  assert.deepEqual(toFaceState(EXPRESSIONS.happy, [1, 1]), {
    ...toFaceState(EXPRESSIONS.happy),
    lid0: 1,
    lid1: 1,
  });
  const peeking = toFaceState(EXPRESSIONS.happy, [1, 0]);
  assert.equal(peeking.lid0, 1);
  assert.equal(peeking.lid1, 0);
});

test("repeated waves replace the previous ones and cleanup stops the animation", () => {
  let reduced = false;
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  const active = new Set<Animation>();
  const calls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
  const sprite = {
    getAnimations: () => [...active],
    animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const listeners = new Map<string, () => void>();
      const animation = {
        addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
        cancel() {
          active.delete(animation);
          listeners.get("cancel")?.();
        },
      } as unknown as Animation;
      calls.push({ keyframes, options });
      active.add(animation);
      return animation;
    },
  };
  try {
    const avatarHands = createHandMotions({
      querySelector: (selector: string) => (selector === "[data-mascot-sprite]" ? sprite : null),
    } as unknown as HTMLElement);
    for (let tap = 0; tap < 20; tap++) avatarHands.wave();
    assert.equal(active.size, 1);
    assert.equal(calls.at(-1)?.options.easing, "linear");
    assert.ok(calls.at(-1)?.keyframes.every((frame) => frame.easing === "steps(1, end)"));
    avatarHands.cancel();
    assert.equal(active.size, 0);
    reduced = true;
    avatarHands.wave();
    assert.equal(active.size, 0);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("holding the presenting pose again keeps the running pose instead of restarting it", () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  let created = 0;
  let cancelled = 0;
  const sprite = {
    animate() {
      created += 1;
      return {
        playState: "finished",
        cancel() {
          cancelled += 1;
        },
      } as unknown as Animation;
    },
  };
  try {
    const avatarHands = createHandMotions({
      querySelector: (selector: string) => (selector === "[data-mascot-sprite]" ? sprite : null),
    } as unknown as HTMLElement);
    for (let update = 0; update < 30; update++) avatarHands.hold();
    assert.equal(created, 1);
    assert.equal(cancelled, 0);
    avatarHands.wave();
    avatarHands.hold();
    assert.equal(created, 3);
  } finally {
    vi.unstubAllGlobals();
  }
});
