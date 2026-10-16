import { expect, test } from "vitest";
import { parseBarInput } from "@/features/home/domain/bar-input";

/** A friend code in the home bar showed a room chip with "nelc-t5u6" and "Entrar". */
test("a NELC code is a friend for someone signed in", () => {
  expect(parseBarInput("NELC-T5U6", { friends: true })).toEqual({
    kind: "friend",
    code: "NELC-T5U6",
  });
  expect(parseBarInput("  nelc t5u6x2 ", { friends: true })).toEqual({
    kind: "friend",
    code: "NELC-T5U6X2",
  });
});

test("rooms read as before, and without an account a NELC code is not a friend", () => {
  expect(parseBarInput("kfa-mtrx-q2p", { friends: true })).toEqual({
    kind: "room",
    code: "kfa-mtrx-q2p",
  });
  expect(parseBarInput("NELC-T5U6", { friends: false }).kind).not.toBe("friend");
  expect(parseBarInput("", { friends: true })).toEqual({ kind: "empty" });
});
