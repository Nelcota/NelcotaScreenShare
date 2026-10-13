import {
  matchRequestedSlugs,
  parseKlipyPage,
  rememberBounded,
  type Gif,
  type GifPage,
} from "@/features/messages/domain/klipy";
import { logBrowserWarning } from "@/lib/telemetry.client";

const KLIPY_API = "https://api.klipy.com/api/v1";
const PER_PAGE = 24;
/** The strictest content filter: the app is for everyone. */
const CONTENT_FILTER = "high";

/** Enough for the picker's pages and the open conversations; older ones are fetched again. */
const MAX_KNOWN = 500;

/** GIFs already seen on this page, so a slug is fetched once. */
const known = new Map<string, Gif>();

function remember(slug: string, gif: Gif) {
  rememberBounded(known, slug, gif, MAX_KNOWN);
}

function endpoint(key: string, path: string, params: Record<string, string>) {
  const url = new URL(`${KLIPY_API}/${encodeURIComponent(key)}/gifs${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url;
}

async function getPage(url: URL): Promise<GifPage> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`KLIPY answered ${response.status}`);
  const page = parseKlipyPage(await response.json());
  for (const gif of page.gifs) remember(gif.slug, gif);
  return page;
}

/**
 * The browser talks to KLIPY directly with the public key (docs/development.md), without a
 * customer id: KLIPY never learns who is who.
 */
export function createKlipy(key: string) {
  const common = { per_page: String(PER_PAGE), content_filter: CONTENT_FILTER, locale: "pt_BR" };
  return {
    trending: (page: number) =>
      getPage(endpoint(key, "/trending", { ...common, page: String(page) })),
    search: (query: string, page: number) =>
      getPage(endpoint(key, "/search", { ...common, q: query, page: String(page) })),
    /** The GIFs of these slugs, from memory when already seen. */
    async bySlugs(slugs: readonly string[]): Promise<Map<string, Gif>> {
      const missing = slugs.filter((slug) => !known.has(slug));
      if (missing.length > 0) {
        const page = await getPage(endpoint(key, "/items", { slugs: missing.join(",") }));
        for (const [slug, gif] of matchRequestedSlugs(missing, page.gifs)) remember(slug, gif);
      }
      const found = slugs.flatMap((slug) => {
        const gif = known.get(slug);
        return gif ? [[slug, gif] as const] : [];
      });
      return new Map(found);
    },
    /** KLIPY's share trigger: counts the send for their ranking. Best effort. */
    share(slug: string) {
      void fetch(endpoint(key, `/share/${encodeURIComponent(slug)}`, {}), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }).catch((error: unknown) => logBrowserWarning("KLIPY share trigger failed", error));
    },
  };
}

export type Klipy = ReturnType<typeof createKlipy>;
