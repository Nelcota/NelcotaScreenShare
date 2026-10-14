import { expect, test } from "vitest";
import { roomTitle } from "@/features/room/domain/room-title";

test("a permanent room keeps its own name; a one-off room is named after its owner", () => {
  expect(roomTitle({ kind: "team", name: "Daily do time" }, "Ana")).toEqual({
    text: "Daily do time",
    followsOwner: false,
  });
  expect(roomTitle({ kind: "personal", name: "Plantão" }, null)).toEqual({
    text: "Plantão",
    followsOwner: false,
  });
  expect(roomTitle({ kind: "ad_hoc", name: "Ignorado" }, "Ana")).toEqual({
    text: "Sala de Ana",
    followsOwner: true,
  });
  expect(roomTitle(undefined, "Bia")).toEqual({ text: "Sala de Bia", followsOwner: true });
  expect(roomTitle(undefined, null)).toBeNull();
  expect(roomTitle({ kind: "team", name: null }, null)).toBeNull();
});
