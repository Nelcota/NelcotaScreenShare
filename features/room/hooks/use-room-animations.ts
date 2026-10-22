import { useEffect, useRef, type RefObject } from "react";
import { gsap, MOTION_DURATION, MOTION_QUERIES, useGSAP } from "@/lib/animation/gsap";
import { Flip } from "@/lib/animation/gsap-flip";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

const FLIP_TARGETS = "[data-flip-id]";
// The bundled Flip types omit `kill`, which the runtime supports.
const FLIP_STATE_OPTIONS = { kill: false, props: "opacity" };

function flipState(root: HTMLElement) {
  return Flip.getState(gsap.utils.toArray<HTMLElement>(FLIP_TARGETS, root), FLIP_STATE_OPTIONS);
}

/**
 * Room animations:
 * - entrance of the top bar and the dock;
 * - staggered entrance of the tiles;
 * - smooth rearrangement with Flip when the layout changes (someone starts/stops
 *   sharing, joins or leaves). The "before" state is captured whenever a
 *   frame is rendered and when the container resizes. An interrupted transition
 *   continues from the visible positions instead of jumping to its old target;
 * - when only the room around the cards changes (`reflowKey`: the chat opening), the
 *   cards fade in at their new place: flying there, two cards side by side crossed each
 *   other on the way to one above the other, and one passed under the chat.
 */
export function useRoomAnimations(
  scope: RefObject<HTMLElement | null>,
  layoutKey: string,
  reflowKey: string,
) {
  const reducedMotion = useReducedMotion();
  const lastState = useRef<Flip.FlipState | null>(null);
  const running = useRef<gsap.core.Timeline | null>(null);
  const lastLayoutKey = useRef(layoutKey);

  // Entrance of the fixed UI (top bar and dock).
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.motion, () => {
        gsap.from("[data-anim=topbar]", {
          y: -12,
          opacity: 0,
          duration: MOTION_DURATION.entrance,
          clearProps: "transform,opacity",
        });
        gsap.from("[data-anim=dock]", {
          y: 16,
          opacity: 0,
          duration: MOTION_DURATION.entrance,
          clearProps: "transform,opacity",
        });
      });
    },
    { scope },
  );

  // Layout: Flip from the last known state.
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const targets = gsap.utils.toArray<HTMLElement>(FLIP_TARGETS, root);
      const previous = lastState.current;
      const onlyReflow = previous !== null && lastLayoutKey.current === layoutKey;
      lastLayoutKey.current = layoutKey;
      Flip.killFlipsOf(previous?.targets ?? targets, false);
      running.current?.kill();
      running.current = null;

      const remember = () => {
        lastState.current = flipState(root);
      };
      const capture = () => {
        remember();
        running.current = null;
      };

      if (reducedMotion) {
        gsap.set(targets, { opacity: 1, clearProps: "transform" });
        capture();
        return;
      }

      if (onlyReflow) {
        gsap.set(targets, { clearProps: "transform" });
        // Positions are final already: a change during the fade starts from them.
        running.current = gsap
          .timeline({ onUpdate: remember, onComplete: capture })
          .fromTo(
            targets,
            { opacity: 0 },
            { opacity: 1, duration: MOTION_DURATION.surface, clearProps: "opacity" },
          );
        return;
      }

      if (!previous) {
        running.current = gsap.timeline({ onUpdate: remember, onComplete: capture }).from(targets, {
          opacity: 0,
          y: 12,
          duration: MOTION_DURATION.entrance,
          stagger: 0.035,
          clearProps: "transform,opacity",
        });
        return;
      }

      // Measure the new layout without transforms left by the interrupted tween.
      gsap.set(targets, { opacity: 1, clearProps: "transform" });
      running.current = Flip.from(previous, {
        targets,
        duration: MOTION_DURATION.layout,
        ease: "power2.inOut",
        scale: true,
        prune: true,
        onEnter: (elements) =>
          gsap.fromTo(
            elements,
            { opacity: 0, y: 10 },
            {
              opacity: 1,
              y: 0,
              duration: MOTION_DURATION.surface,
              stagger: 0.035,
              clearProps: "transform,opacity",
            },
          ),
        onUpdate: remember,
        onComplete: capture,
      });
    },
    { scope, dependencies: [layoutKey, reflowKey, reducedMotion] },
  );

  // Resizing changes positions without changing layoutKey: update the base state.
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      if (running.current?.isActive()) return;
      lastState.current = flipState(root);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [scope]);
}
