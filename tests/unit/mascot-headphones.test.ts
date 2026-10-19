import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Mascot } from "@/features/mascot/ui/Mascot";

/** The headband's outer stroke (MascotAccessories). */
const HEADBAND = 'd="M118 252C99 183';

/**
 * The band crosses the top of the head: drawn behind the artwork, only its left end showed and
 * the headphones looked slipped on the landing's mascot.
 */
test("the headband is drawn over the mascot artwork, not behind it", () => {
  const html = renderToString(
    createElement(TooltipProvider, null, createElement(Mascot, { accessory: "headphones" })),
  );
  const artwork = html.indexOf("<img");
  expect(artwork).toBeGreaterThan(-1);
  expect(html.indexOf(HEADBAND)).toBeGreaterThan(artwork);
});

/** Width and height of each rect in one cup, in drawing order. */
function cupSizes(html: string, rotation: string): string[] {
  const start = html.indexOf(`rotate(${rotation}`);
  const cup = html.slice(start, html.indexOf("</g>", start));
  return [...cup.matchAll(/width="(\d+)" height="(\d+)"/g)].map(
    ([, width, height]) => `${width}x${height}`,
  );
}

/** Each side was drawn differently: a thin cup on the left, a wide one with the pad on the right. */
test("both headphone cups have the same parts and sizes", () => {
  const html = renderToString(
    createElement(TooltipProvider, null, createElement(Mascot, { accessory: "headphones" })),
  );
  const left = cupSizes(html, "16 ");
  expect(left).toHaveLength(4);
  expect(left.toSorted()).toEqual(cupSizes(html, "-14 ").toSorted());
});
