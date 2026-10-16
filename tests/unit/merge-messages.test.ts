import { describe, expect, test } from "vitest";
import { mergeMessages } from "@/features/messages/domain/timeline";

/** Ids sort like the database's (uuidv7): "m001" < "m002". */
const message = (n: number) => ({ id: `m${String(n).padStart(3, "0")}`, body: `${n}` });
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => message(from + index));
const ids = (list: { id: string }[]) => list.map((item) => Number(item.id.slice(1)));

describe("merging the conversation's pages", () => {
  test("new messages after loading older ones leave no gap", () => {
    // 70 messages: the page shows 21–70, "Mensagens anteriores" brings 1–20.
    const seen = mergeMessages(range(1, 20), range(21, 70));
    // Five arrive: the newest page is now 26–75.
    const shown = mergeMessages(seen, range(26, 75));
    expect(ids(shown)).toEqual(ids(range(1, 75)));
  });

  test("the newest page wins: edits show, and a message deleted inside it goes away", () => {
    const seen = range(1, 10);
    const page = range(5, 10)
      .filter((item) => item.id !== "m007")
      .map((item) => (item.id === "m008" ? { ...item, body: "editada" } : item));
    const shown = mergeMessages(seen, page);
    expect(ids(shown)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10]);
    expect(shown.find((item) => item.id === "m008")?.body).toBe("editada");
  });
});
