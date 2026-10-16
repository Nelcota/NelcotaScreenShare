/**
 * The friends column, per browser: collapsed into a rail or open, and its width. Kept in a
 * cookie so the server draws it right on the first paint, without a jump.
 */
export const COLUMN_COOKIE = "nelcota_column";

export const COLUMN_WIDTH = { min: 240, max: 420, initial: 288 } as const;

export interface ColumnLayout {
  collapsed: boolean;
  width: number;
}

export const DEFAULT_COLUMN_LAYOUT: ColumnLayout = {
  collapsed: false,
  width: COLUMN_WIDTH.initial,
};

export function clampColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return COLUMN_WIDTH.initial;
  return Math.round(Math.min(COLUMN_WIDTH.max, Math.max(COLUMN_WIDTH.min, width)));
}

/** The cookie value: "1.300" is collapsed, 300 pixels wide when open. */
export function serializeColumnLayout(layout: ColumnLayout): string {
  return `${layout.collapsed ? 1 : 0}.${clampColumnWidth(layout.width)}`;
}

function cookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

/** Reads the layout from a Cookie header; anything odd falls back to the default. */
export function parseColumnLayout(cookieHeader: string | null): ColumnLayout {
  if (!cookieHeader) return DEFAULT_COLUMN_LAYOUT;
  const value = cookieValue(cookieHeader, COLUMN_COOKIE);
  const match = value?.match(/^([01])\.(\d{2,4})$/);
  if (!match) return DEFAULT_COLUMN_LAYOUT;
  return { collapsed: match[1] === "1", width: clampColumnWidth(Number(match[2])) };
}

/** Key that collapses and opens the column (free among the room shortcuts). */
export const COLUMN_SHORTCUT = "a";
