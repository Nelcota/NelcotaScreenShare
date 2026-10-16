import { describe, expect, test } from "vitest";
import { ringStatusLine } from "@/features/ringing/domain/ring";

const ring = (id: string, calleeName: string, state: "ringing" | "missed" | "declined") => ({
  id,
  calleeId: `${id}-pessoa`,
  calleeName,
  state,
});

describe("the ring line on the screen of someone alone in the room", () => {
  test("nothing without a ring", () => {
    expect(ringStatusLine([])).toBeNull();
  });

  test("a ring going out wins, with a way to cancel it", () => {
    expect(
      ringStatusLine([ring("a", "Caio Lima", "missed"), ring("b", "Bia Souza", "ringing")]),
    ).toEqual({
      text: "Chamando Bia…",
      cancel: { ringId: "b", calleeId: "b-pessoa" },
    });
  });

  test("then how it ended", () => {
    expect(ringStatusLine([ring("a", "Bia Souza", "declined")])).toEqual({
      text: "Bia recusou",
      cancel: null,
    });
    expect(ringStatusLine([ring("a", "Bia Souza", "missed")])).toEqual({
      text: "Bia não atendeu",
      cancel: null,
    });
  });
});
