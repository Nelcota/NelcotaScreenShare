import { describe, expect, test } from "vitest";
import { requestsButtonLabel, requestsButtonText } from "@/features/friends/domain/requests-button";

describe("friend requests button", () => {
  test("says Pedidos with none waiting", () => {
    expect(requestsButtonText(0)).toBe("Pedidos");
    expect(requestsButtonLabel(0)).toBe("Pedidos de amizade");
  });

  test("shows how many are waiting", () => {
    expect(requestsButtonText(2)).toBe("2");
    expect(requestsButtonText(99)).toBe("99");
    expect(requestsButtonText(120)).toBe("99+");
  });

  test("the accessible name keeps the exact count", () => {
    expect(requestsButtonLabel(120)).toBe("Pedidos de amizade: 120");
  });
});
