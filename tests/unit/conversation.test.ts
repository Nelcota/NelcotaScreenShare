import { describe, expect, test } from "vitest";
import {
  decideGroupCreation,
  GIF_SLUG_PATTERN,
  groupPickNote,
  inviteesOf,
  normalizeGroupName,
  normalizeMessageBody,
} from "@/features/messages/domain/conversation";

const ME = "me";

function friendsOf(...ids: string[]) {
  return new Set(ids);
}

describe("group creation", () => {
  test("says how many friends are still missing", () => {
    expect(groupPickNote(0, 5)).toBe("Escolha mais 2 amigos.");
    expect(groupPickNote(1, 5)).toBe("Escolha mais 1 amigo.");
    expect(groupPickNote(2, 5)).toBeNull();
    expect(groupPickNote(9, 9)).toBeNull();
  });

  test("explains why a single friend makes no group", () => {
    expect(groupPickNote(0, 1)).toBe("Um grupo precisa de você e mais 2 amigos.");
    expect(groupPickNote(1, 1)).toBe("Um grupo precisa de você e mais 2 amigos.");
  });

  test("leaves the empty list to ask for friends", () => {
    expect(groupPickNote(0, 0)).toBeNull();
  });

  test("needs two friends or more", () => {
    expect(
      decideGroupCreation({ creatorId: ME, memberIds: ["a"], friendIds: friendsOf("a") }),
    ).toBe("too_few");
    expect(
      decideGroupCreation({ creatorId: ME, memberIds: ["a", "b"], friendIds: friendsOf("a", "b") }),
    ).toBe("ok");
  });

  test("ignores the creator and repeated ids when counting", () => {
    expect(inviteesOf(ME, [ME, "a", "a", "b"])).toEqual(["a", "b"]);
    expect(
      decideGroupCreation({ creatorId: ME, memberIds: [ME, "a", "a"], friendIds: friendsOf("a") }),
    ).toBe("too_few");
  });

  test("holds up to 10 people, counting the creator", () => {
    const nine = Array.from({ length: 9 }, (_, index) => `f${index}`);
    const ten = [...nine, "f9"];
    expect(decideGroupCreation({ creatorId: ME, memberIds: nine, friendIds: new Set(nine) })).toBe(
      "ok",
    );
    expect(decideGroupCreation({ creatorId: ME, memberIds: ten, friendIds: new Set(ten) })).toBe(
      "too_many",
    );
  });

  test("refuses anyone who is not a friend", () => {
    expect(
      decideGroupCreation({ creatorId: ME, memberIds: ["a", "b"], friendIds: friendsOf("a") }),
    ).toBe("not_friends");
  });
});

describe("message text", () => {
  test("is trimmed, and blank text is no message", () => {
    expect(normalizeMessageBody("  oi  ")).toBe("oi");
    expect(normalizeMessageBody("   \n ")).toBeNull();
    expect(normalizeMessageBody(null)).toBeNull();
  });

  test("a blank group name falls back to the members' names", () => {
    expect(normalizeGroupName("  ")).toBeNull();
    expect(normalizeGroupName(" Noite do filme ")).toBe("Noite do filme");
  });

  test("GIF slugs accept letters, digits, hyphens and underscores only", () => {
    expect(GIF_SLUG_PATTERN.test("funny-cat_123")).toBe(true);
    expect(GIF_SLUG_PATTERN.test("../etc")).toBe(false);
    expect(GIF_SLUG_PATTERN.test("")).toBe(false);
  });
});
