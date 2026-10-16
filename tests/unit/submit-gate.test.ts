import { describe, expect, test } from "vitest";
import { createSubmitGate } from "@/lib/operations/submit-gate";

describe("submit gate", () => {
  test("a second submit while the first is on its way is dropped, at once", () => {
    const gate = createSubmitGate();
    expect(gate.enter()).toBe(true);
    expect(gate.enter()).toBe(false);
    gate.release();
    expect(gate.enter()).toBe(true);
  });
});
