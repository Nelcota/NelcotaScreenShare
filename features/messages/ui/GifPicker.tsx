import { Star, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { favoriteGif, unfavoriteGif } from "@/features/messages/actions";
import type { Gif } from "@/features/messages/domain/klipy";
import { useKlipy } from "@/features/messages/hooks/use-gif";
import { useOperation } from "@/lib/operations/use-operation";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { cn } from "@/lib/utils";
import { SearchField } from "@/components/SearchField";

type GifTab = "trending" | "favorites";

const SEARCH_DELAY_MS = 350;

/** In English on purpose: KLIPY's attribution guidelines require this exact placeholder. */
const KLIPY_PLACEHOLDER = "Search KLIPY";

/** Trending, a search or the favourites; empty while loading, null on failure. */
function useGifList(tab: GifTab, query: string, favorites: readonly string[]) {
  const klipy = useKlipy();
  const [gifs, setGifs] = useState<Gif[] | null>([]);
  useEffect(() => {
    if (!klipy) return;
    let current = true;
    const load = async () => {
      if (query) return (await klipy.search(query, 1)).gifs;
      if (tab === "favorites") {
        const found = await klipy.bySlugs(favorites);
        return favorites.flatMap((slug) => found.get(slug) ?? []);
      }
      return (await klipy.trending(1)).gifs;
    };
    const timer = setTimeout(
      () => {
        load()
          .then((list) => current && setGifs(list))
          .catch((error: unknown) => {
            logBrowserWarning("KLIPY request failed", error);
            if (current) setGifs(null);
          });
      },
      query ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [klipy, tab, query, favorites]);
  return gifs;
}

function onError({ error }: { error: { serverError?: string } }) {
  toast.error(error.serverError ?? "Não foi possível agora.");
}

function FavoriteToggle({ slug, favorite }: { slug: string; favorite: boolean }) {
  const add = useOperation(favoriteGif, { onError });
  const remove = useOperation(unfavoriteGif, { onError });
  return (
    <button
      type="button"
      aria-label={favorite ? "Tirar dos favoritos" : "Favoritar"}
      aria-pressed={favorite}
      onClick={() => (favorite ? remove.execute({ slug }) : add.execute({ slug }))}
      className={cn(
        "absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-canvas/70 text-warning backdrop-blur transition-opacity",
        favorite
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
      )}
    >
      <Star className={cn("size-3.5", favorite && "fill-current")} aria-hidden="true" />
    </button>
  );
}

function GifTabs({ tab, onChange }: { tab: GifTab; onChange: (next: GifTab) => void }) {
  const tabs = [
    { id: "trending", label: "Em alta", icon: TrendingUp },
    { id: "favorites", label: "Favoritos", icon: Star },
  ] as const;
  return (
    <fieldset aria-label="GIFs" className="flex gap-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={tab === id}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
            tab === id ? "bg-ink/[0.07] text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </fieldset>
  );
}

function GifGrid({
  gifs,
  favorites,
  onPick,
  empty,
}: {
  gifs: Gif[] | null;
  favorites: readonly string[];
  onPick: (gif: Gif) => void;
  empty: string;
}) {
  if (gifs === null)
    return (
      <p className="px-3 py-6 text-center text-sm text-ink-muted">
        KLIPY fora do ar. Tente de novo.
      </p>
    );
  if (gifs.length === 0)
    return <p className="px-3 py-6 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="min-h-0 flex-1 columns-2 gap-2 overflow-y-auto px-3">
      {gifs.map((gif) => (
        <li key={gif.slug} className="group relative mb-2 break-inside-avoid">
          <button
            type="button"
            onClick={() => onPick(gif)}
            className="block w-full"
            aria-label={gif.title || "Enviar GIF"}
          >
            <img
              src={gif.preview.url}
              alt=""
              width={gif.preview.width}
              height={gif.preview.height}
              loading="lazy"
              className="h-auto w-full rounded-xl bg-surface-3"
            />
          </button>
          <FavoriteToggle slug={gif.slug} favorite={favorites.includes(gif.slug)} />
        </li>
      ))}
    </ul>
  );
}

/** KLIPY's picker: search, trending and favourites, with the required attribution. */
export function GifPicker({
  favorites,
  onPick,
}: {
  favorites: readonly string[];
  onPick: (gif: Gif) => void;
}) {
  const [tab, setTab] = useState<GifTab>("trending");
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const gifs = useGifList(tab, trimmed, favorites);
  const empty =
    tab === "favorites" && !trimmed ? "Nenhum favorito ainda." : "Nenhum GIF encontrado.";
  return (
    <section
      aria-label="GIFs"
      className="flex max-h-[min(26rem,var(--radix-popover-content-available-height))] w-full flex-col rounded-3xl border border-line bg-popover shadow-soft"
    >
      <div className="flex flex-col gap-2 p-3 pb-2">
        <SearchField
          label="Buscar GIF"
          placeholder={KLIPY_PLACEHOLDER}
          value={query}
          onChange={setQuery}
          className="h-10"
        />
        {trimmed ? null : <GifTabs tab={tab} onChange={setTab} />}
      </div>
      <GifGrid gifs={gifs} favorites={favorites} onPick={onPick} empty={empty} />
      <p className="border-t border-line px-3 py-2 text-right text-[0.6875rem] font-semibold tracking-wide text-ink-subtle">
        Powered by KLIPY
      </p>
    </section>
  );
}
