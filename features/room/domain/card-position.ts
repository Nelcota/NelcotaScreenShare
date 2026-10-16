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

/** The corners keep this far from the sides, as the card's first place does. */
const CORNER_MARGIN = 16;
/** Bottom corners stay above a page's message box, like the card's first place (6rem). */
const BOTTOM_CORNER_CLEARANCE = 96;
/** Dropped inside the middle of the screen (this share of each side), it stays put. */
const CENTER_SHARE = 0.4;

function inCenter(position: number, size: number): boolean {
  const margin = (size * (1 - CENTER_SHARE)) / 2;
  return position >= margin && position <= size - margin;
}

/** A box on screen, in viewport pixels, such as a page's main field. */
export interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Does the card, at this offset, cover any of these areas? */
export function coversAny(
  offset: CardOffset,
  card: Size,
  viewport: Size,
  areas: readonly Area[],
): boolean {
  const left = viewport.width - offset.right - card.width;
  const top = viewport.height - offset.bottom - card.height;
  return areas.some(
    (area) =>
      left < area.left + area.width &&
      left + card.width > area.left &&
      top < area.top + area.height &&
      top + card.height > area.top,
  );
}

function nearestCorner(offset: CardOffset, card: Size, viewport: Size): CardOffset {
  const centerX = viewport.width - offset.right - card.width / 2;
  const centerY = viewport.height - offset.bottom - card.height / 2;
  const corner = {
    right:
      centerX < viewport.width / 2 ? viewport.width - card.width - CORNER_MARGIN : CORNER_MARGIN,
    bottom:
      centerY < viewport.height / 2
        ? viewport.height - card.height - TOP_CLEARANCE
        : BOTTOM_CORNER_CLEARANCE,
  };
  return clampOffset(corner, card, viewport);
}

/**
 * Where a dropped card settles: the nearest corner (below the top bar, above a message
 * box), or right where it was when dropped in the middle of the screen. A card dropped on
 * an area it must keep clear (the start's room field) goes to the corner even then.
 */
export function snapToCorner(
  offset: CardOffset,
  card: Size,
  viewport: Size,
  keepClear: readonly Area[] = [],
): CardOffset {
  const centerX = viewport.width - offset.right - card.width / 2;
  const centerY = viewport.height - offset.bottom - card.height / 2;
  const centered = inCenter(centerX, viewport.width) && inCenter(centerY, viewport.height);
  if (centered && !coversAny(offset, card, viewport, keepClear)) {
    return clampOffset(offset, card, viewport);
  }
  return nearestCorner(offset, card, viewport);
}

/**
 * A saved place that now covers an area to keep clear (another page has its field there)
 * moves to the nearest corner; elsewhere it stays as saved.
 */
export function clearOfAreas(
  offset: CardOffset,
  card: Size,
  viewport: Size,
  keepClear: readonly Area[],
): CardOffset {
  if (!coversAny(offset, card, viewport, keepClear)) return offset;
  return nearestCorner(offset, card, viewport);
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
