import { expect, test } from "vitest";
import { directEntryNotice } from "@/features/room/domain/join";

/** Joining straight from Chamar or a ring says how the microphone came in, and how to switch. */
test("the direct entry notice names the microphone state and its key", () => {
  expect(directEntryNotice(true, "M")).toBe("Microfone ligado · M para desligar");
  expect(directEntryNotice(false, "M")).toBe("Microfone desligado · M para ligar");
});
