/**
 * Atlas poses and animated values of the mint-green mascot.
 *
 * Facial features, each animated by a spring towards the expression's value:
 * - tilt: tilts the head (degrees)
 * - pupil: pupil size (smaller = wide eyes)
 * - lid: how closed the eyelids are (0 open, 1 closed)
 * - rest: how much the body settles and flattens to sleep
 */
export const EXPRESSIONS = {
  neutral: { tilt: 0, pupil: 1, lid: 0, rest: 0 },
  happy: { tilt: 0, pupil: 1, lid: 0, rest: 0 },
  celebrate: { tilt: 0, pupil: 1.05, lid: 0, rest: 0 },
  grumpy: { tilt: 0, pupil: 1, lid: 0.42, rest: 0 },
  worried: { tilt: 0, pupil: 1, lid: 0.1, rest: 0 },
  surprised: { tilt: 0, pupil: 0.68, lid: 0, rest: 0 },
  skeptical: { tilt: -7, pupil: 1, lid: 0.18, rest: 0 },
  curious: { tilt: -9, pupil: 1.04, lid: 0.05, rest: 0 },
  pet: { tilt: -5, pupil: 1, lid: 1, rest: 0.25 },
  highFive: { tilt: -4, pupil: 1.05, lid: 0, rest: 0 },
  yawning: { tilt: -5, pupil: 1, lid: 0.82, rest: 0.15 },
  stretching: { tilt: -3, pupil: 1, lid: 0.35, rest: 0 },
  ticklish: { tilt: -6, pupil: 0.85, lid: 0.55, rest: 0.05 },
  sneezing: { tilt: 9, pupil: 1, lid: 1, rest: 0.3 },
  waiting: { tilt: 2, pupil: 1, lid: 0.08, rest: 0 },
  listening: { tilt: -4, pupil: 1.03, lid: 0, rest: 0 },
  presenting: { tilt: -3, pupil: 1, lid: 0.12, rest: 0.16 },
  walking: { tilt: 0, pupil: 1, lid: 0, rest: 0 },
  noticing: { tilt: -7, pupil: 1.03, lid: 0.08, rest: 0.06 },
  greeting: { tilt: 0, pupil: 1.05, lid: 0, rest: 0 },
  welcoming: { tilt: -3, pupil: 1.03, lid: 0, rest: 0 },
  sleepy: { tilt: 3, pupil: 1, lid: 0.6, rest: 0.35 },
  asleep: { tilt: 7, pupil: 1, lid: 1, rest: 1 },
} as const;

export type Expression = keyof typeof EXPRESSIONS;
export type Face = { -readonly [K in keyof (typeof EXPRESSIONS)["neutral"]]: number };
/** Animated state: like Face, but with one eyelid per eye (to peek with one eye only). */
export type FaceState = Omit<Face, "lid"> & { lid0: number; lid1: number };

/** When two reactions happen together, the one listed first here is shown. */
export const PRIORITY: readonly Expression[] = [
  // Any interaction removes sleep; while inactive, it may relax even with Caps Lock on.
  "asleep",
  "grumpy",
  "worried",
  "celebrate",
  "yawning",
  "stretching",
  "sleepy",
  "surprised",
  "skeptical",
  "pet",
  "sneezing",
  "ticklish",
  "waiting",
  "welcoming",
  "greeting",
  "noticing",
  "walking",
  "highFive",
  "presenting",
  "listening",
  "happy",
  "curious",
];

/** Expression with one eyelid per eye; `lids` overrides the expression's (e.g. password). */
export function toFaceState({ lid, ...face }: Face, lids?: readonly [number, number]): FaceState {
  return { ...face, lid0: lids?.[0] ?? lid, lid1: lids?.[1] ?? lid };
}
