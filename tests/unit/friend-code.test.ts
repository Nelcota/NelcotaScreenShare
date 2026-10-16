import { describe, expect, test } from "vitest";
import {
  FRIEND_CODE_ALPHABET,
  formatFriendCode,
  looksLikeEmail,
  parseFriendCode,
  friendCodeLength,
  randomFriendCode,
} from "@/features/friends/domain/friend-code";

describe("friend code", () => {
  test("accepts the code however it is typed", () => {
    expect(parseFriendCode("NELC-4K7Q")).toBe("4K7Q");
    expect(parseFriendCode("nelc-4k7q")).toBe("4K7Q");
    expect(parseFriendCode(" NELC 4K7Q ")).toBe("4K7Q");
    expect(parseFriendCode("4k7q")).toBe("4K7Q");
  });

  test("accepts five characters, for when the codes grow", () => {
    expect(parseFriendCode("NELC-4K7QX")).toBe("4K7QX");
  });

  test("refuses lookalike characters and wrong lengths", () => {
    expect(parseFriendCode("NELC-4K0Q")).toBeNull();
    expect(parseFriendCode("NELC-4KOQ")).toBeNull();
    expect(parseFriendCode("NELC-4K1Q")).toBeNull();
    expect(parseFriendCode("NELC-4KIQ")).toBeNull();
    expect(parseFriendCode("NELC-4KLQ")).toBeNull();
    expect(parseFriendCode("NELC-4K7")).toBeNull();
    expect(parseFriendCode("NELC-4K7QXYZ")).toBe("4K7QXYZ");
    expect(parseFriendCode("NELC-4K7QXYZW")).toBeNull();
    expect(parseFriendCode("")).toBeNull();
  });

  test("shows the code with the prefix", () => {
    expect(formatFriendCode("4K7Q")).toBe("NELC-4K7Q");
  });

  test("draws six characters from the alphabet", () => {
    let next = 0;
    const code = randomFriendCode((max) => next++ % max);
    expect(code).toBe(FRIEND_CODE_ALPHABET.slice(0, 6));
    expect(parseFriendCode(code)).toBe(code);
    expect(randomFriendCode((max) => max - 1)).toBe("ZZZZZZ");
  });

  test("draws six characters first, seven once those keep clashing; old short codes still read", () => {
    expect([0, 1, 2, 3, 7].map(friendCodeLength)).toEqual([6, 6, 6, 7, 7]);
    expect(randomFriendCode(() => 0, 7)).toBe("2222222");
    expect(parseFriendCode("NELC-4K7Q")).toBe("4K7Q");
  });

  test("tells an e-mail from a code", () => {
    expect(looksLikeEmail("ana@exemplo.com")).toBe(true);
    expect(looksLikeEmail("NELC-4K7Q")).toBe(false);
  });
});
