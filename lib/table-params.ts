import { createParser, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { parseDateInput } from "@/lib/date-input";

/**
 * URL parameters shared by every admin table (state in the URL: the link can be
 * shared and history navigation works). Each feature adds its own filters.
 */
export const pageParsers = {
  cursor: parseAsString,
  dir: parseAsStringLiteral(["next", "prev"] as const).withDefault("next"),
  ordem: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};

/**
 * A calendar day (YYYY-MM-DD). Anything else, like "2026-13-45", is no filter: otherwise the
 * list would be filtered by a date the date picker cannot show.
 */
const parseAsDay = createParser({
  parse: (value) => (parseDateInput(value) ? value : null),
  serialize: (value: string) => value,
});

/** "de/até" (from/until) range in São Paulo days (YYYY-MM-DD), shared by the admin tables. */
export const periodParsers = {
  de: parseAsDay,
  ate: parseAsDay,
};

/** Changing a filter or the sort goes back to the first page. */
export const resetPage = { cursor: null, dir: null } as const;

/** A table's filters: any value set makes them active, and "Limpar" sets them all to null. */
export function filterState<K extends string>(keys: readonly K[], params: Record<K, unknown>) {
  const cleared: Partial<Record<K, null>> = {};
  for (const key of keys) cleared[key] = null;
  return { active: keys.some((key) => Boolean(params[key])), cleared };
}

export const PAGE_SIZE = 50;

/**
 * Target of a bulk action: IDs checked on the page (up to 500) or every
 * result of the current filter (`query` = URL query string, without the page),
 * which the server reapplies with a limit of 10,000.
 */
export type BulkSelection = { kind: "ids"; ids: string[] } | { kind: "filter"; query: string };

export const BULK_IDS_LIMIT = 500;
export const BULK_FILTER_LIMIT = 10_000;

/** Filter query string, without the page cursor. */
export function filterQuery(search: URLSearchParams | string): string {
  const params = new URLSearchParams(search);
  params.delete("cursor");
  params.delete("dir");
  params.sort();
  return params.toString();
}
