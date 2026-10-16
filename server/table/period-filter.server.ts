import { gte, lt, type AnyColumn, type SQL } from "drizzle-orm";
import { endOfDayInSaoPaulo, startOfDayInSaoPaulo } from "@/lib/format";

interface Period {
  de: string | null;
  ate: string | null;
}

/**
 * The instants of a "from/until" range of whole São Paulo days. An inverted range (from
 * after until) is read in order instead of matching nothing.
 */
export function periodBounds({ de, ate }: Period): { from?: Date; until?: Date } {
  const [first, last] = de && ate && de > ate ? [ate, de] : [de, ate];
  return {
    from: first ? startOfDayInSaoPaulo(first) : undefined,
    until: last ? endOfDayInSaoPaulo(last) : undefined,
  };
}

/** "from/until" filter of the panel tables: whole days in the São Paulo time zone. */
export function periodFilters(column: AnyColumn, period: Period): SQL[] {
  const { from, until } = periodBounds(period);
  return [from ? gte(column, from) : undefined, until ? lt(column, until) : undefined].filter(
    (filter): filter is SQL => filter !== undefined,
  );
}
