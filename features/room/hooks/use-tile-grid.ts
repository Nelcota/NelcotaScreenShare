import { useEffect, useState, type RefObject } from "react";
import { fitTileGrid, type TileGrid } from "@/features/room/domain/tile-grid";

/** Space between the cards, the same as the grid's `gap-4`. */
export const TILE_GAP = 16;
/** Two people on a wide screen stop at a comfortable size instead of filling it all. */
const MAX_TILE_WIDTH = 960;

/**
 * The card width that fills the area for this many people, measured again whenever the
 * area changes size (window, chat opening, column folding). `undefined` before measuring.
 */
export function useTileGrid(
  areaRef: RefObject<HTMLElement | null>,
  count: number,
): TileGrid | undefined {
  const [grid, setGrid] = useState<TileGrid>();
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () =>
      setGrid(
        fitTileGrid({
          count,
          width: area.clientWidth,
          height: area.clientHeight,
          gap: TILE_GAP,
          maxTileWidth: MAX_TILE_WIDTH,
        }),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [areaRef, count]);
  return grid;
}
