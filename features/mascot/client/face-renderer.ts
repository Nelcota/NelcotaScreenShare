import type { FaceState } from "@/features/mascot/domain/face";
import { avatarFrame } from "@/features/mascot/domain/avatar-frames";
import {
  EYE_SHAPES,
  pupilOffset,
  eyelidOffset,
  type Gaze,
} from "@/features/mascot/domain/eye-tracking";

/** Updates only the drawing, without React renders on every frame. */
export function createFaceRenderer(face: HTMLElement) {
  const sprite = face.querySelector<HTMLElement>("[data-mascot-sprite]");
  if (!sprite) return null;
  const pupils = [...sprite.querySelectorAll<SVGElement>("[data-mascot-pupil]")].map((element) => ({
    element,
    right: element.dataset.mascotEye === "1",
  }));
  const lids = [...sprite.querySelectorAll<SVGElement>("[data-mascot-lid]")];
  return {
    lids,
    render(gaze: Gaze, state: FaceState, blinking = false) {
      const root = face.closest<HTMLElement>("[data-slot=mascot]");
      // A blink closes the vector eyelids, keeping the body's atlas pose stable.
      const pose = avatarFrame(
        root?.dataset.expression,
        blinking ? 0 : state.lid0,
        blinking ? 0 : state.lid1,
      );
      face.style.setProperty("--sprite-column", String(pose.column));
      face.style.setProperty("--sprite-row", String(pose.row));
      const tilt = state.tilt + gaze.x * 0.65;
      face.style.setProperty("--tilt", tilt.toFixed(2));
      face.style.setProperty("--rest", state.rest.toFixed(3));
      for (const lid of lids) {
        const index = lid.dataset.mascotEye === "1" ? 1 : 0;
        const closed = Math.min(1, Math.max(0, state[index === 1 ? "lid1" : "lid0"]));
        lid.setAttribute("visibility", closed > 0.002 ? "visible" : "hidden");
        lid.setAttribute(
          "transform",
          `translate(0 ${eyelidOffset(EYE_SHAPES[index].ry, closed).toFixed(2)})`,
        );
      }
      const scale = Math.min(1.05, Math.max(0.68, state.pupil));
      for (const { element, right } of pupils) {
        const direction = right
          ? { x: gaze.rightX, y: gaze.rightY }
          : { x: gaze.leftX, y: gaze.leftY };
        const { x, y } = pupilOffset(direction, EYE_SHAPES[right ? 1 : 0], scale, tilt);
        element.setAttribute(
          "transform",
          `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`,
        );
      }
    },
  };
}

export type FaceRenderer = NonNullable<ReturnType<typeof createFaceRenderer>>;
