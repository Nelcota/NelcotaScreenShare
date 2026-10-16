type Cell = { column: number; row: number };

/** Artwork offsets keep accessories aligned with each atlas pose. */
export const AVATAR_OFFSETS = [
  { x: 0, y: 0 },
  { x: 488, y: 0 },
  { x: 998, y: 0 },
  { x: -24, y: 512 },
  { x: 488, y: 512 },
  { x: 998, y: 512 },
];

const NEUTRAL: Cell = { column: 0, row: 0 };
const EYES_CLOSED: Cell = { column: 0, row: 1 };

/** Atlas cell for each expression (missing ones use the neutral cell). */
const CELLS = new Map<string, Cell>([
  ["happy", { column: 1, row: 0 }],
  ["celebrate", { column: 1, row: 0 }],
  ["highFive", { column: 1, row: 0 }],
  ["welcoming", { column: 1, row: 0 }],
  ["grumpy", { column: 1, row: 1 }],
  ["worried", { column: 1, row: 1 }],
  ["skeptical", { column: 1, row: 1 }],
  ["surprised", { column: 2, row: 1 }],
  ["ticklish", { column: 2, row: 1 }],
  ["asleep", EYES_CLOSED],
]);

/** Atlas grid: three columns, two rows, no cutouts over the face. */
export function avatarFrame(expression: string | undefined, lid0 = 0, lid1 = 0): Cell {
  // The blink only closes the eyelids, without lowering the hand during the greeting.
  if (expression === "greeting") return { column: 2, row: 0 };
  if (expression === "yawning") return { column: 2, row: 1 };
  if (Math.max(lid0, lid1) > 0.85) return EYES_CLOSED;
  return (expression === undefined ? undefined : CELLS.get(expression)) ?? NEUTRAL;
}

/** A/B poses of the same arm: the discrete swap keeps the whole drawing intact. */
export const AVATAR_WAVE = [
  { transform: "translate(-33.333333%, 0)", offset: 0 },
  { transform: "translate(-66.666667%, 0)", offset: 0.2 },
  { transform: "translate(-33.333333%, 0)", offset: 0.4 },
  { transform: "translate(-66.666667%, 0)", offset: 0.6 },
  { transform: "translate(-33.333333%, 0)", offset: 0.8 },
  { transform: "translate(-33.333333%, 0)", offset: 1 },
].map((frame) => ({ ...frame, easing: "steps(1, end)" }));
