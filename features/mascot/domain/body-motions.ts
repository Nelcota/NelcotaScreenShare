/** Whole-body motions (Web Animations). Turned off with reduced motion. */
export type Motion = { keyframes: Keyframe[]; options: KeyframeAnimationOptions };

export const PET: Motion = {
  keyframes: [
    { scale: "1", rotate: "0deg" },
    { scale: "1.04 0.94", rotate: "-3deg", offset: 0.3 },
    { scale: "1.02 0.97", rotate: "2deg", offset: 0.65 },
    { scale: "1", rotate: "0deg" },
  ],
  options: { duration: 1100, easing: "ease-in-out" },
};

export const STRETCH: Motion = {
  keyframes: [
    { scale: "1", translate: "0 0" },
    { scale: "0.96 1.08", translate: "0 -3%", offset: 0.45 },
    { scale: "1.02 0.98", translate: "0 0", offset: 0.8 },
    { scale: "1", translate: "0 0" },
  ],
  options: { duration: 1100, easing: "ease-in-out" },
};

export const SNEEZE: Motion = {
  keyframes: [
    { rotate: "-3deg", scale: "1" },
    { rotate: "7deg", scale: "1.06 0.9", offset: 0.25 },
    { rotate: "-2deg", scale: "0.98 1.03", offset: 0.55 },
    { rotate: "0deg", scale: "1" },
  ],
  options: { duration: 420, easing: "ease-out" },
};

/** Shakes the head as if saying "no" (wrong password). */
export const SHAKE: Motion = {
  keyframes: [
    { translate: "0" },
    { translate: "-3% 0" },
    { translate: "2.5% 0" },
    { translate: "-2% 0" },
    { translate: "1% 0" },
    { translate: "0" },
  ],
  options: { duration: 450, easing: "ease-out" },
};

/** Little jump of joy: one big jump and one small. */
export const JUMP: Motion = {
  keyframes: [
    { translate: "0 0" },
    { translate: "0 -8%", offset: 0.32 },
    { translate: "0 0", offset: 0.58 },
    { translate: "0 -3%", offset: 0.78 },
    { translate: "0 0" },
  ],
  options: { duration: 720, easing: "ease-out" },
};

/** A "that's it" nod of the head. */
export const NOD: Motion = {
  keyframes: [
    { translate: "0 0" },
    { translate: "0 2%" },
    { translate: "0 0" },
    { translate: "0 1.5%" },
    { translate: "0 0" },
  ],
  options: { duration: 480, easing: "ease-in-out" },
};

/** The host's restrained excitement after a polite wave. */
export const HOST_HOP: Motion = {
  keyframes: [
    { translate: "0 0", scale: "1" },
    { translate: "0 1%", scale: "1.02 0.97", offset: 0.2 },
    { translate: "0 -4%", scale: "0.99 1.02", offset: 0.5 },
    { translate: "0 0", scale: "1" },
  ],
  options: { duration: 650, easing: "ease-out" },
};

/** Lowers into a comfortable pose after inviting the presenter to begin. */
export const SETTLE: Motion = {
  keyframes: [{ scale: "1" }, { scale: "1.025 0.97", offset: 0.5 }, { scale: "1" }],
  options: { duration: 900, easing: "ease-in-out" },
};

/** Shrinks at the moment of touch (immediate response)... */
export const PRESS: Motion = {
  keyframes: [{ scale: "1" }, { scale: "0.92" }],
  options: { duration: 90, easing: "ease-out", fill: "forwards" },
};
