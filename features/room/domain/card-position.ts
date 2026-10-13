/** Where the floating call card sits, as distances from the right and bottom edges. */
export interface CardOffset {
  right: number;
  bottom: number;
}

interface Size {
  width: number;
  height: number;
}

const EDGE_MARGIN = 8;
/** The card stays below the page's top bar and headers (5rem), so it never covers them. */
const TOP_CLEARANCE = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Keeps the whole card on screen, a few pixels from every edge and below the top bar. */
export function clampOffset(offset: CardOffset, card: Size, viewport: Size): CardOffset {
  return {
    right: clamp(offset.right, EDGE_MARGIN, viewport.width - card.width - EDGE_MARGIN),
    bottom: clamp(offset.bottom, EDGE_MARGIN, viewport.height - card.height - TOP_CLEARANCE),
  };
}

/** Reads a saved offset; anything that was not written here is ignored. */
export function parseOffset(raw: string | null): CardOffset | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    if (!("right" in value) || !("bottom" in value)) return undefined;
    const { right, bottom } = value;
    if (typeof right !== "number" || typeof bottom !== "number") return undefined;
    if (!Number.isFinite(right) || !Number.isFinite(bottom)) return undefined;
    return { right, bottom };
  } catch {
    return undefined;
  }
}

const STEP = 16;
const LARGE_STEP = 64;

/** Which way each arrow moves the card: +right goes left, +bottom goes up. */
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/** The card moved by an arrow key (Shift for a bigger step); other keys move nothing. */
export function nudgeOffset(
  offset: CardOffset,
  key: string,
  large: boolean,
): CardOffset | undefined {
  const direction = ARROWS[key];
  if (!direction) return undefined;
  const step = large ? LARGE_STEP : STEP;
  return { right: offset.right + direction[0] * step, bottom: offset.bottom + direction[1] * step };
}
