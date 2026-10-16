/** Inside the app the column's room filter lives in the address, so the middle follows it. */
export const ROOM_FILTER_PARAM = "filtro";

export type RoomFilter = "active" | "favorites" | "archived";

const BY_PARAM: Record<string, RoomFilter> = { favoritas: "favorites", arquivadas: "archived" };

export const ROOM_FILTER_PARAM_VALUE: Record<RoomFilter, string | null> = {
  active: null,
  favorites: "favoritas",
  archived: "arquivadas",
};

export function isRoomFilter(value: string): value is RoomFilter {
  return value === "active" || value === "favorites" || value === "archived";
}

/** The filter in the address; anything else is the active rooms. */
export function roomFilterFrom(params: URLSearchParams): RoomFilter {
  return BY_PARAM[params.get(ROOM_FILTER_PARAM) ?? ""] ?? "active";
}

/** The same address with this filter; the active rooms drop the parameter. */
export function withRoomFilter(params: URLSearchParams, filter: RoomFilter): URLSearchParams {
  const next = new URLSearchParams(params);
  const value = ROOM_FILTER_PARAM_VALUE[filter];
  if (value) next.set(ROOM_FILTER_PARAM, value);
  if (!value) next.delete(ROOM_FILTER_PARAM);
  return next;
}
