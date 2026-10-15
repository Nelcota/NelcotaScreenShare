import type { Gif } from "@/features/messages/domain/klipy";

export type GifTab = "trending" | "favorites";

/** A finished request: the list, or null when KLIPY failed. */
export type GifResult = { key: string; gifs: Gif[] | null };

/** What the grid shows: still loading, KLIPY failed, or the list (maybe empty). */
export type GifListView =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; gifs: Gif[] };

/**
 * Which list is asked for, as text: the favourites only matter on their own tab, so a new
 * favourite does not reload trending or a search.
 */
export function gifListKey(tab: GifTab, query: string, favorites: readonly string[]): string {
  if (query) return `search:${query}`;
  if (tab === "favorites") return `favorites:${favorites.join(",")}`;
  return "trending";
}

/** A result for another key is an old list: until the new one arrives, it is loading. */
export function gifListView(result: GifResult | undefined, key: string): GifListView {
  if (!result || result.key !== key) return { state: "loading" };
  if (result.gifs === null) return { state: "failed" };
  return { state: "ready", gifs: result.gifs };
}
