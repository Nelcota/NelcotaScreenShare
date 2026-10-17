/** Width over height of every person's card in the grid. */
const TILE_RATIO = 16 / 9;

export interface TileGridInput {
  count: number;
  /** The area the grid may use, in pixels. */
  width: number;
  height: number;
  /** Space between cards, in pixels. */
  gap: number;
  /** A single card never grows past this width. */
  maxTileWidth: number;
}

export interface TileGrid {
  columns: number;
  tileWidth: number;
}

function widthFor(columns: number, { count, width, height, gap }: TileGridInput): number {
  const rows = Math.ceil(count / columns);
  const byWidth = (width - gap * (columns - 1)) / columns;
  const byHeight = ((height - gap * (rows - 1)) / rows) * TILE_RATIO;
  return Math.min(byWidth, byHeight);
}

/**
 * How the cards fill the area, as in Discord: the number of columns that gives the largest
 * 16:9 card. Three people go two above and one below; a last short row is centered by the
 * layout. A card stays whole and never shrinks below zero.
 */
export function fitTileGrid(input: TileGridInput): TileGrid {
  const count = Math.max(1, Math.floor(input.count));
  const best = Array.from({ length: count }, (_, index) => index + 1).reduce<TileGrid>(
    (current, columns) => {
      const tileWidth = widthFor(columns, { ...input, count });
      return tileWidth > current.tileWidth ? { columns, tileWidth } : current;
    },
    { columns: 1, tileWidth: 0 },
  );
  return {
    columns: best.columns,
    tileWidth: Math.max(0, Math.floor(Math.min(best.tileWidth, input.maxTileWidth))),
  };
}
