import { cn } from "@/lib/utils";

/**
 * A person's card surface. Pointing at it (mouse only) lifts it a little, without lighting
 * the border; with reduced motion it stays still. The photo opens the profile: the big one,
 * or the small one in the name pill when the camera covers the face.
 */
export const TILE_SURFACE = cn(
  "relative flex size-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-tile-line bg-tile shadow-soft",
  "transition-[translate] duration-200 group-hover/tile:-translate-y-0.5 motion-reduce:group-hover/tile:translate-y-0",
);
