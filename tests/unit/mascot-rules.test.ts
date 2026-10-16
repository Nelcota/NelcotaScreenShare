import { describe, expect, it } from "vitest";
import { EXPRESSIONS } from "@/features/mascot/domain/face";
import { pairActivity } from "@/features/mascot/domain/pair";
import {
  allowsPlay,
  blinkLid,
  blocksPlay,
  canBlink,
  canGreet,
  canSneeze,
  faceResponse,
  gazeFocus,
  isSleeping,
  listeningFace,
  reactionTo,
  waitingGaze,
} from "@/features/mascot/domain/rules";

describe("rules per expression", () => {
  it("sleep: still gaze and slow eyelids, but the pupil behaves normally", () => {
    expect(isSleeping("sleepy")).toBe(true);
    expect(isSleeping("asleep")).toBe(true);
    expect(isSleeping("happy")).toBe(false);
    expect(gazeFocus("asleep")).toBe("idle");
    expect(faceResponse("asleep", "lid0")).toBe(0.85);
    expect(faceResponse("asleep", "pupil")).toBe(0.32);
    expect(faceResponse("happy", "lid0")).toBe(0.32);
  });

  it("what blocks play, blinking, waving and sneezing", () => {
    for (const expression of ["grumpy", "worried", "skeptical", "asleep"] as const) {
      expect(blocksPlay(expression)).toBe(true);
    }
    expect(blocksPlay("sleepy")).toBe(false);
    expect(canBlink("worried")).toBe(false);
    expect(canBlink("skeptical")).toBe(true);
    expect(canGreet("grumpy")).toBe(false);
    expect(canGreet("sleepy")).toBe(true);
    expect(canSneeze("curious")).toBe(true);
    expect(canSneeze("waiting")).toBe(false);
  });

  it("where to look besides the pointer", () => {
    expect(gazeFocus("walking")).toBe("partner");
    expect(gazeFocus("greeting")).toBe("partner");
    expect(gazeFocus("presenting")).toBe("stage");
    expect(gazeFocus("neutral")).toBe("free");
  });

  it("waiting, listening and blinking", () => {
    expect(waitingGaze(0).x).toBe(0);
    expect(Math.abs(waitingGaze(1100 * (Math.PI / 2)).x - 0.55)).toBeLessThan(1e-9);
    const face = { tilt: 0, pupil: 1, lid0: 0, lid1: 0, rest: 0 };
    expect(listeningFace(face, 1)).toEqual({ ...face, tilt: 3, pupil: 1.05 });
    expect(blinkLid(0.5)).toBe(1);
    expect(blinkLid(1)).toBe(0);
  });
});

describe("reaction to screen notices", () => {
  it("celebrate: forgets the error, jumps and waves hard", () => {
    expect(reactionTo({ type: "celebrate" })).toMatchObject({
      clear: ["error"],
      set: { reason: "celebrate", expression: "celebrate" },
      motion: "jump",
      wave: "celebrate",
    });
  });

  it("grumpy shakes the head; worried does not", () => {
    expect(reactionTo({ type: "upset", mood: "grumpy" })).toMatchObject({
      clear: ["celebrate", "typing"],
      stopGestures: true,
      lookAtTarget: true,
      motion: "shake",
    });
    expect(reactionTo({ type: "upset", mood: "worried" }).motion).toBeUndefined();
  });

  it("doubt toggles on and off; a nod only moves the head and the hand", () => {
    expect(reactionTo({ type: "doubt", active: true }).set?.expression).toBe("skeptical");
    expect(reactionTo({ type: "doubt", active: false }).unset).toBe("doubt");
    expect(reactionTo({ type: "nod" })).toEqual({ clear: [], motion: "nod", wave: "simple" });
  });
});

describe("activities", () => {
  it("a dropped call leaves it worried, with no play on top", () => {
    expect(EXPRESSIONS).toHaveProperty("worried");
    expect(blocksPlay("worried")).toBe(true);
    expect(allowsPlay("worried")).toBe(false);
  });
});

describe("home page pair", () => {
  it("activity for each phase; while the room opens, both wait", () => {
    expect(pairActivity("approach", false)).toBe("walking");
    expect(pairActivity("hit", false)).toBe("greeting");
    expect(pairActivity("rest", false)).toBe("idle");
    expect(pairActivity("hit", true)).toBe("waiting");
  });
});
