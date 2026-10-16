import { Star, TrendingUp } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { favoriteGif, unfavoriteGif } from "@/features/messages/actions";
import {
  gifListKey,
  gifListView,
  type GifListView,
  type GifResult,
  type GifTab,
} from "@/features/messages/domain/gif-list";
import type { Gif } from "@/features/messages/domain/klipy";
import { useKlipy } from "@/features/messages/hooks/use-gif";
import { useOperation } from "@/lib/operations/use-operation";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { cn } from "@/lib/utils";
import { SearchField } from "@/components/SearchField";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SEARCH_DELAY_MS = 350;

/** In English on purpose: KLIPY's attribution guidelines require this exact placeholder. */
const KLIPY_PLACEHOLDER = "Search KLIPY";

/** Trending, a search or the favourites, keyed so an old list never stands in for a new one. */
function useGifList(tab: GifTab, query: string, favorites: readonly string[]): GifListView {
  const klipy = useKlipy();
  const [result, setResult] = useState<GifResult>();
  const key = gifListKey(tab, query, favorites);
  const load = useEffectEvent(async () => {
    if (!klipy) return [];
    if (query) return (await klipy.search(query, 1)).gifs;
    if (tab === "favorites") {
      const found = await klipy.bySlugs(favorites);
      return favorites.flatMap((slug) => found.get(slug) ?? []);
    }
    return (await klipy.trending(1)).gifs;
  });
  useEffect(() => {
    if (!klipy) return;
    let current = true;
    const fetchList = async () => {
      try {
        const gifs = await load();
        if (current) setResult({ key, gifs });
      } catch (error) {
        logBrowserWarning("KLIPY request failed", error);
        if (current) setResult({ key, gifs: null });
      }
    };
    const timer = setTimeout(
      () => void fetchList(),
      key.startsWith("search:") ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [klipy, key]);
  return gifListView(result, key);
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
    <ToggleGroup
      type="single"
      aria-label="GIFs"
      value={tab}
      // A second press on the chosen one would leave none chosen: it stays.
      onValueChange={(next) => {
        if (next === "trending" || next === "favorites") onChange(next);
      }}
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <ToggleGroupItem key={id} value={id}>
          <Icon aria-hidden="true" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function GridNote({ text }: { text: string }) {
  return <output className="block px-3 py-6 text-center text-sm text-ink-muted">{text}</output>;
}

function GifGrid({
  view,
  favorites,
  onPick,
  empty,
}: {
  view: GifListView;
  favorites: readonly string[];
  onPick: (gif: Gif) => void;
  empty: string;
}) {
  if (view.state === "loading") return <GridNote text="Carregando GIFs…" />;
  if (view.state === "failed") return <GridNote text="KLIPY fora do ar. Tente de novo." />;
  const { gifs } = view;
  if (gifs.length === 0) return <GridNote text={empty} />;
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
  const view = useGifList(tab, trimmed, favorites);
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
      <GifGrid view={view} favorites={favorites} onPick={onPick} empty={empty} />
      <p className="border-t border-line px-3 py-2 text-right text-[0.6875rem] font-semibold tracking-wide text-ink-subtle">
        Powered by KLIPY
      </p>
    </section>
  );
}
