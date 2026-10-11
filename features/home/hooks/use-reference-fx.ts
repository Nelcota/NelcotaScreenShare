import type { RefObject } from "react";
import { gsap } from "@/lib/animation/gsap";
import { useScrollScene } from "@/lib/animation/scroll-scene";

/** A scroll window for one element: the effect plays while it crosses this band. */
function band(trigger: Element) {
  return { trigger, start: "top 95%", end: "top 55%", scrub: 0.8 };
}

/**
 * Scroll effect for the reference sections (details, browsers, price, updates, FAQ): each
 * block marked `data-fx` rises 48px and fades in across the 95%–55% viewport band.
 * Its `data-fx-item` children rise 32px in staggered order. Both effects follow the
 * scroll in either direction; reduced motion leaves the content as rendered.
 */
export function useReferenceFx(scope: RefObject<HTMLElement | null>) {
  useScrollScene(scope, (root) => {
    for (const block of gsap.utils.toArray<HTMLElement>("[data-fx]", root)) {
      gsap.from(block, {
        y: 48,
        opacity: 0.1,
        ease: "power2.out",
        scrollTrigger: band(block),
      });
      const items = block.querySelectorAll("[data-fx-item]");
      if (items.length === 0) continue;
      gsap.from(items, {
        y: 32,
        opacity: 0,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: band(block),
      });
    }
  });
}
