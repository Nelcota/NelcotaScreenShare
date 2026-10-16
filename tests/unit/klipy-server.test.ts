import { afterEach, describe, expect, test, vi } from "vitest";

const env: { KLIPY_API_KEY?: string } = { KLIPY_API_KEY: "chave-de-teste" };
vi.mock("@/server/env.server", () => ({ getEnv: () => env }));
const warn = vi.fn();
vi.mock("@/server/logger.server", () => ({ logger: { warn } }));

const { withGifs } = await import("@/features/messages/server/klipy.server");

const file = { url: "https://static.klipy.com/lol.webp", width: 320, height: 180 };
/** What /gifs/items answered for a GIF sent from search: the slug without its "--id". */
const itemsAnswer = {
  result: true,
  data: {
    data: [
      {
        slug: "lol-league-of-legends-81",
        title: "LoL",
        file: { sm: { webp: file }, md: { webp: file } },
      },
    ],
    has_next: false,
  },
};

function message(id: string, gifSlug: string | null) {
  return {
    id,
    authorId: "bia",
    authorName: "Bia",
    body: gifSlug ? null : "oi",
    gifSlug,
    createdAt: new Date("2026-10-12T18:00:00Z"),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  warn.mockClear();
});

describe("GIFs resolved on the server", () => {
  test("a message's GIF arrives ready, from one request, and is reused afterwards", async () => {
    const fetch = vi.fn(async (_url: URL) => Response.json(itemsAnswer));
    vi.stubGlobal("fetch", fetch);
    const stored = "lol-league-of-legends-81--k4usnkQkl";
    const page = await withGifs({
      messages: [message("1", stored), message("2", null)],
      hasMore: false,
    });
    expect(page.messages[0]?.gif?.full.url).toBe(file.url);
    expect(page.messages[1]?.gif).toBeNull();
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get("slugs")).toBe(stored);

    await withGifs({ messages: [message("3", stored)], hasMore: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("a GIF KLIPY no longer has shows as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: { data: [] } })),
    );
    const page = await withGifs({ messages: [message("1", "gone--x")], hasMore: false });
    expect(page.messages[0]?.gif).toBeNull();
  });

  test("when KLIPY fails the page still loads and the failure is logged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    const page = await withGifs({ messages: [message("1", "down--y")], hasMore: false });
    expect(page.messages[0]?.gif).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
