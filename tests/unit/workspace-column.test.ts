import { describe, expect, test } from "vitest";
import { columnTabOf } from "@/app/routes/app/workspace-column.server";

describe("column tab", () => {
  test("follows the page in the middle", () => {
    expect(columnTabOf("/salas")).toBe("salas");
    expect(columnTabOf("/salas/0190-abc")).toBe("salas");
    expect(columnTabOf("/times/0190-abc/salas/0190-def")).toBe("times");
    expect(columnTabOf("/inicio")).toBe("amigos");
    expect(columnTabOf("/conta")).toBe("amigos");
    expect(columnTabOf("/salasx")).toBe("amigos");
  });
});
