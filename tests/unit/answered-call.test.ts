import { expect, test } from "vitest";
import { answeredCallPath } from "@/features/room/domain/answered-call";

test("an accepted ring opens the room marked to join on its own", () => {
  expect(answeredCallPath("/sala/abc-defg-hij")).toBe("/sala/abc-defg-hij?atendeu=1");
  expect(answeredCallPath("/sala/abc-defg-hij?convite=x")).toBe(
    "/sala/abc-defg-hij?convite=x&atendeu=1",
  );
});
