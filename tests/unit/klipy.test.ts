import { describe, expect, test } from "vitest";
import { matchRequestedSlugs, parseKlipyPage, type Gif } from "@/features/messages/domain/klipy";

const file = (size: number) => ({
  url: `https://static.klipy.com/${size}.webp`,
  width: size,
  height: size,
});

describe("KLIPY responses", () => {
  test("keeps the small file for the picker and the medium one for the chat", () => {
    const page = parseKlipyPage({
      result: true,
      data: {
        data: [
          {
            slug: "dancing-cat",
            title: "Gato",
            file: { sm: { webp: file(120) }, md: { webp: file(320) } },
          },
          { type: "ad", width: 300 },
          { slug: "no-files", file: {} },
        ],
        has_next: true,
      },
    });
    expect(page.hasNext).toBe(true);
    expect(page.gifs).toEqual([
      { slug: "dancing-cat", title: "Gato", preview: file(120), full: file(320) },
    ]);
  });

  test("an unexpected body gives an empty page", () => {
    expect(parseKlipyPage(null)).toEqual({ gifs: [], hasNext: false });
    expect(parseKlipyPage({ data: "oops" })).toEqual({ gifs: [], hasNext: false });
  });
});

const gif = (slug: string): Gif => ({ slug, title: slug, preview: file(120), full: file(320) });

describe("GIFs asked for by slug", () => {
  test('a stored "name--id" slug finds the item /items answers as "name"', () => {
    const stored = "lol-league-of-legends-81--k4usnkQkl";
    const found = matchRequestedSlugs([stored], [gif("lol-league-of-legends-81")]);
    expect(found.get(stored)?.slug).toBe("lol-league-of-legends-81");
  });

  test("an exact slug wins, and each item answers a single slug", () => {
    const found = matchRequestedSlugs(
      ["cat--a", "cat", "dog--b", "gone--c"],
      [gif("cat"), gif("dog")],
    );
    expect(found.get("cat")?.slug).toBe("cat");
    expect(found.has("cat--a")).toBe(false);
    expect(found.get("dog--b")?.slug).toBe("dog");
    expect(found.has("gone--c")).toBe(false);
  });

  test("a name that only starts the same is not a match", () => {
    expect(matchRequestedSlugs(["cats--x"], [gif("cat")]).size).toBe(0);
  });
});
