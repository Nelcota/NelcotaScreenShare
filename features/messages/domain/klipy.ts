/** A GIF as the screen draws it: a small file for the picker, a medium one in the chat. */
export interface Gif {
  slug: string;
  title: string;
  preview: GifFile;
  full: GifFile;
}

interface GifFile {
  url: string;
  width: number;
  height: number;
}

export interface GifPage {
  gifs: Gif[];
  hasNext: boolean;
}

type Formats = Partial<Record<"webp" | "gif" | "jpg", Partial<GifFile>>>;
type Sizes = Partial<Record<"hd" | "md" | "sm" | "xs", Formats>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The first complete file among these sizes, WebP before GIF. */
function pickFile(file: Sizes, sizes: readonly (keyof Sizes)[]): GifFile | null {
  for (const size of sizes) {
    for (const format of ["webp", "gif"] as const) {
      const candidate = file[size]?.[format];
      if (candidate?.url && candidate.width && candidate.height) {
        return { url: candidate.url, width: candidate.width, height: candidate.height };
      }
    }
  }
  return null;
}

/** One KLIPY item, or null for ads and anything without usable files. */
function parseKlipyGif(raw: unknown): Gif | null {
  if (!isRecord(raw) || typeof raw.slug !== "string" || !isRecord(raw.file)) return null;
  const file = raw.file as Sizes;
  const preview = pickFile(file, ["sm", "xs", "md"]);
  const full = pickFile(file, ["md", "sm", "hd"]);
  if (!preview || !full) return null;
  const title = typeof raw.title === "string" ? raw.title : "";
  return { slug: raw.slug, title, preview, full };
}

/** KLIPY answers { result, data: { data: [...], has_next } }. */
export function parseKlipyPage(json: unknown): GifPage {
  const data = isRecord(json) && isRecord(json.data) ? json.data : {};
  const items = Array.isArray(data.data) ? data.data : [];
  const gifs = items.map(parseKlipyGif).filter((gif): gif is Gif => gif !== null);
  return { gifs, hasNext: data.has_next === true };
}

/** The item answers a requested slug: the same slug, or KLIPY's short form without "--id". */
function answers(requested: string, gif: Gif): boolean {
  return requested === gif.slug || requested.startsWith(`${gif.slug}--`);
}

/**
 * The GIFs of /items keyed by the slugs that were asked for. KLIPY answers "name--id" (as
 * search gives it, and as messages store it) with only "name", so an exact match comes first
 * and each item answers one slug.
 */
export function matchRequestedSlugs(requested: readonly string[], gifs: readonly Gif[]) {
  const unused = [...gifs];
  const take = (find: (gif: Gif) => boolean) => {
    const index = unused.findIndex(find);
    if (index < 0) return null;
    return unused.splice(index, 1)[0] ?? null;
  };
  const exact = requested.map((slug) => take((gif) => gif.slug === slug));
  const pairs = requested.flatMap((slug, index) => {
    const gif = exact[index] ?? take((candidate) => answers(slug, candidate));
    return gif ? [[slug, gif] as const] : [];
  });
  return new Map(pairs);
}
