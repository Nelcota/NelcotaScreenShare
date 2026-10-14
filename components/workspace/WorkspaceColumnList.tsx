import { Star, Users, Video } from "lucide-react";
import { useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import { roomFilterFrom, withRoomFilter, type RoomFilter } from "./room-filter";
import { cn } from "@/lib/utils";
import { SearchField } from "@/components/SearchField";
import { searchable } from "@/lib/search-text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface ColumnItem {
  id: string;
  href: string;
  name: string;
  detail?: string;
  favorite?: boolean;
  archived?: boolean;
}

const ROOM_FILTERS: { id: RoomFilter; label: string }[] = [
  { id: "active", label: "Todas" },
  { id: "favorites", label: "Favoritas" },
  { id: "archived", label: "Arquivadas" },
];

const ICONS = { room: Video, team: Users };

function byFilter(filter: RoomFilter) {
  return (item: ColumnItem) => {
    if (filter === "favorites") return Boolean(item.favorite) && !item.archived;
    if (filter === "archived") return Boolean(item.archived);
    return !item.archived;
  };
}

function Filters({ value, onChange }: { value: RoomFilter; onChange: (next: RoomFilter) => void }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label="Filtrar a lista de salas"
      value={value}
      onValueChange={(next) => {
        const chosen = ROOM_FILTERS.find((filter) => filter.id === next);
        if (chosen) onChange(chosen.id);
      }}
      className="px-3 pt-2"
    >
      {ROOM_FILTERS.map((filter) => (
        <ToggleGroupItem
          key={filter.id}
          value={filter.id}
          aria-label={`Filtrar ${filter.label.toLowerCase()}`}
          className="data-[state=on]:bg-surface-3"
        >
          {filter.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function ItemLine({ item, kind }: { item: ColumnItem; kind: keyof typeof ICONS }) {
  const Icon = ICONS[kind];
  return (
    <li>
      <NavLink
        viewTransition
        to={item.href}
        className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand aria-[current=page]:bg-surface-3"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-soft">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className={cn("min-w-0 flex-1", item.archived && "opacity-70")}>
          <span className="block truncate text-sm font-semibold">{item.name}</span>
          {item.detail ? (
            <span className="block truncate text-xs text-ink-muted">{item.detail}</span>
          ) : null}
        </span>
        {item.favorite ? (
          <Star
            className="size-3.5 shrink-0 fill-status-away text-status-away"
            aria-label="Favorita"
          />
        ) : null}
      </NavLink>
    </li>
  );
}

/**
 * The Salas or Times tab of the column: search, the room filters, and the list. Picking an
 * item opens it in the middle.
 */
export function WorkspaceColumnList({
  kind,
  items,
  searchLabel,
  empty,
}: {
  kind: keyof typeof ICONS;
  items: ColumnItem[];
  searchLabel: string;
  empty: string;
}) {
  const [query, setQuery] = useState("");
  // The filter lives in the address (?filtro=), so the cards in the middle follow it.
  const [params, setParams] = useSearchParams();
  const filter = roomFilterFrom(params);
  const setFilter = (next: RoomFilter) =>
    setParams((current) => withRoomFilter(current, next), {
      replace: true,
      preventScrollReset: true,
    });
  const wanted = searchable(query.trim());
  const filtered = kind === "room" ? items.filter(byFilter(filter)) : items;
  const shown = wanted
    ? filtered.filter((item) => searchable(item.name).includes(wanted))
    : filtered;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-3">
        <SearchField label={searchLabel} value={query} onChange={setQuery} />
      </div>
      {kind === "room" ? <Filters value={filter} onChange={setFilter} /> : null}
      <nav aria-label={searchLabel} className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-3">
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {shown.map((item) => (
              <ItemLine key={item.id} item={item} kind={kind} />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
