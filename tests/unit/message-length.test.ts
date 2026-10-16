import { describe, expect, test } from "vitest";
import { messageLengthNote } from "@/features/messages/domain/conversation";

describe("message length note", () => {
  test("nothing until close to the limit", () => {
    expect(messageLengthNote(10)).toBeNull();
    expect(messageLengthNote(1799)).toBeNull();
  });

  test("a counter near the limit, and over it a warning that blocks sending", () => {
    expect(messageLengthNote(1950)).toEqual({ text: "1.950/2.000", over: false });
    expect(messageLengthNote(5000)).toEqual({ text: "5.000/2.000", over: true });
  });
});
