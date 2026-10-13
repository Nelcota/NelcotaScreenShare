import { describe, expect, test } from "vitest";
import { ROOM_FILTER_PARAM_VALUE, roomFilterFrom } from "@/components/workspace/room-filter";

describe("room filter in the address", () => {
  test("reads the column's filter and falls back to the active rooms", () => {
    expect(roomFilterFrom(new URLSearchParams("filtro=favoritas"))).toBe("favorites");
    expect(roomFilterFrom(new URLSearchParams("filtro=arquivadas"))).toBe("archived");
    expect(roomFilterFrom(new URLSearchParams("filtro=outra"))).toBe("active");
    expect(roomFilterFrom(new URLSearchParams())).toBe("active");
  });

  test("goes back and forth", () => {
    expect(ROOM_FILTER_PARAM_VALUE.active).toBeNull();
    const value = ROOM_FILTER_PARAM_VALUE.archived ?? "";
    expect(roomFilterFrom(new URLSearchParams({ filtro: value }))).toBe("archived");
  });
});
