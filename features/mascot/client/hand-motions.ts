import { AVATAR_WAVE } from "@/features/mascot/domain/avatar-frames";
import { prefersReducedMotion } from "@/lib/animation/motion";

/** Finite gestures; the mascot uses two full poses of the same arm. */
export function createHandMotions(root: HTMLElement) {
  const sprite = root.querySelector<HTMLElement>("[data-mascot-sprite]");
  let animation: Animation | undefined;
  /** The held pose is on: holding again would restart it from the neutral pose for a frame. */
  let holding = false;
  const cancelSprite = () => {
    animation?.cancel();
    animation = undefined;
    holding = false;
  };
  return {
    hold() {
      // Called on every update while presenting (pointer moves, blinks): keep the pose as is.
      if (holding && animation?.playState !== "idle") return;
      cancelSprite();
      if (!sprite || prefersReducedMotion()) return;
      holding = true;
      // With reduced motion, the expression already uses the static raised-hand pose.
      animation = sprite.animate([{ transform: "translate(-66.666667%, 0)" }], {
        duration: 1,
        fill: "forwards",
      });
    },
    wave(celebrating = false) {
      cancelSprite();
      if (!sprite || prefersReducedMotion()) return;
      animation = sprite.animate(AVATAR_WAVE, {
        duration: celebrating ? 1100 : 900,
        easing: "linear",
      });
    },
    cancel: cancelSprite,
  };
}
