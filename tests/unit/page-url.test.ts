import { describe, expect, test } from "vitest";
import { pageUrl } from "@/server/page-url.server";

const at = (path: string) => pageUrl(new Request(`http://localhost:3000${path}`));

describe("page url", () => {
  test("a data request reads as the page it belongs to", () => {
    const url = at("/salas.data?filtro=arquivadas&_routes=app");
    expect(url.pathname).toBe("/salas");
    expect(url.search).toBe("?filtro=arquivadas");
    expect(at("/_root.data").pathname).toBe("/");
  });

  test("a page request stays as it is", () => {
    expect(at("/salas/0190-abc?antes=x").pathname + at("/salas/0190-abc?antes=x").search).toBe(
      "/salas/0190-abc?antes=x",
    );
  });
});
