import { matchRequestedSlugs, parseKlipyPage, type Gif } from "@/features/messages/domain/klipy";
import type { MessagePage, StoredMessage } from "@/features/messages/server/messages.server";
import { getEnv } from "@/server/env.server";
import { logger } from "@/server/logger.server";

const KLIPY_API = "https://api.klipy.com/api/v1";
/** A slow KLIPY never holds the conversation back. */
const TIMEOUT_MS = 3_000;
/** Media links last; an hour keeps reopened conversations off KLIPY. */
const CACHE_MS = 60 * 60_000;
const MAX_CACHED = 2_000;

/** Slug → GIF (null when KLIPY no longer has it), shared by every conversation. */
const cache = new Map<string, { gif: Gif | null; at: number }>();

function cached(slug: string, now: number) {
  const entry = cache.get(slug);
  if (!entry || now - entry.at > CACHE_MS) return undefined;
  return entry;
}

function remember(slug: string, gif: Gif | null, now: number) {
  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(slug, { gif, at: now });
}

async function fetchItems(key: string, slugs: readonly string[]): Promise<Map<string, Gif>> {
  const url = new URL(`${KLIPY_API}/${encodeURIComponent(key)}/gifs/items`);
  url.searchParams.set("slugs", slugs.join(","));
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`KLIPY answered ${response.status}`);
  return matchRequestedSlugs(slugs, parseKlipyPage(await response.json()).gifs);
}

/**
 * The GIFs of these slugs, resolved here so the browser never calls KLIPY to show a message.
 * A slug KLIPY no longer has maps to null; when KLIPY fails, the slugs are left out.
 */
async function resolveGifs(slugs: readonly string[]): Promise<Map<string, Gif | null>> {
  const key = getEnv().KLIPY_API_KEY;
  const now = Date.now();
  const unique = [...new Set(slugs)];
  const known = unique.flatMap((slug) => {
    const entry = cached(slug, now);
    return entry ? [[slug, entry.gif] as const] : [];
  });
  const missing = unique.filter((slug) => !cached(slug, now));
  if (!key || missing.length === 0) return new Map(known);
  try {
    const found = await fetchItems(key, missing);
    const fresh = missing.map((slug) => [slug, found.get(slug) ?? null] as const);
    for (const [slug, gif] of fresh) remember(slug, gif, now);
    return new Map([...known, ...fresh]);
  } catch (error) {
    logger.warn({ err: error, count: missing.length }, "could not resolve GIFs from KLIPY");
    return new Map(known);
  }
}

export type MessageWithGif = StoredMessage & { gif: Gif | null };

/** A page of messages with each GIF ready to draw. */
export async function withGifs(
  page: MessagePage,
): Promise<{ messages: MessageWithGif[]; hasMore: boolean }> {
  const slugs = page.messages.flatMap((message) => (message.gifSlug ? [message.gifSlug] : []));
  const gifs = slugs.length > 0 ? await resolveGifs(slugs) : new Map<string, Gif | null>();
  const messages = page.messages.map((message) => ({
    ...message,
    gif: message.gifSlug ? (gifs.get(message.gifSlug) ?? null) : null,
  }));
  return { messages, hasMore: page.hasMore };
}
