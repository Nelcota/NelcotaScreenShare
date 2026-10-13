import { describe, expect, test } from "vitest";
import { canBeCalled, shownStatus } from "@/features/friends/domain/presence-status";

describe("presence status", () => {
  test("friends see the chosen status only while the person is connected", () => {
    expect(shownStatus("online", true)).toBe("online");
    expect(shownStatus("away", true)).toBe("away");
    expect(shownStatus("busy", true)).toBe("busy");
    expect(shownStatus("busy", false)).toBe("offline");
  });

  test("invisible reads as offline", () => {
    expect(shownStatus("invisible", true)).toBe("offline");
  });

  test("Ausente can still be called; Ocupado and Offline cannot", () => {
    expect(canBeCalled("online")).toBe(true);
    expect(canBeCalled("away")).toBe(true);
    expect(canBeCalled("busy")).toBe(false);
    expect(canBeCalled("offline")).toBe(false);
  });
});
