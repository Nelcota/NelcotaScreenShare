import { LogOut, SunMoon, User, Video } from "lucide-react";
import { reportUnlessNetworkFailure } from "@/lib/telemetry.client";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { searchPanelAction } from "@/features/admin/search/actions";
import { currentTheme, switchTheme } from "@/lib/theme";
import type { NavGroup } from "@/features/admin/shell/server/nav.server";
import { NAV_ICONS } from "./nav-icons";

type RunCommand = (action: () => void) => void;
type GoTo = (href: string) => void;

type SearchData = NonNullable<Awaited<ReturnType<typeof searchPanelAction>>["data"]>;

/** The term's results, or none when the search failed (the list shows "Nada encontrado"). */
async function searchFor(q: string): Promise<SearchData | undefined> {
  try {
    return (await searchPanelAction({ q })).data;
  } catch (error) {
    reportUnlessNetworkFailure("Panel search failed:", error);
    return undefined;
  }
}

/**
 * Called directly, not through a router fetcher: a POST there would refresh every loader of
 * the page on each pause in typing. Answers for an old term are dropped.
 */
function usePanelSearch() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{ q: string; data: SearchData | undefined }>();
  const term = query.trim();
  const isPending = term.length >= 2 && answer?.q !== term;
  const results = term.length >= 2 && answer?.q === term ? answer.data : undefined;

  // Searches on the server after a pause in typing.
  useEffect(() => {
    if (term.length < 2) return;
    let current = true;
    const run = async () => {
      const data = await searchFor(term);
      if (current) setAnswer({ q: term, data });
    };
    const timer = setTimeout(() => void run(), 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [term]);

  return { query, setQuery, term, results, isPending };
}

type PanelSearchResults = ReturnType<typeof usePanelSearch>["results"];

function useToggleShortcut(open: boolean, onOpenChange: (open: boolean) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);
}

function SearchResultGroups({
  results,
  term,
  goTo,
}: {
  results: PanelSearchResults;
  term: string;
  goTo: GoTo;
}) {
  if (!results) return null;
  return (
    <>
      {results.rooms.length > 0 ? (
        <CommandGroup heading="Salas">
          {results.rooms.map((room) => (
            <CommandItem
              key={room.id}
              // The typed text goes in the value: cmdk's local filter does not hide the result.
              value={`${term} sala ${room.code}`}
              onSelect={() => goTo(`/admin/salas/${room.id}`)}
            >
              <Video aria-hidden="true" />
              <span className="font-sans tabular-nums">{room.code}</span>
              {room.status === "active" ? (
                <span className="ml-auto text-xs text-danger">ao vivo</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      {results.people.length > 0 ? (
        <CommandGroup heading="Participantes">
          {results.people.map((person) => (
            <CommandItem
              key={person.id}
              value={`${term} pessoa ${person.id}`}
              onSelect={() => goTo(`/admin/usuarios/${person.id}`)}
            >
              <User aria-hidden="true" />
              <span className="truncate">{person.name}</span>
              <span className="ml-auto truncate text-xs text-ink-muted">{person.email}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </>
  );
}

function NavigationGroups({ groups, goTo }: { groups: NavGroup[]; goTo: GoTo }) {
  return groups.map((group) => (
    <CommandGroup key={group.label} heading={group.label}>
      {group.items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        return (
          <CommandItem
            key={item.href}
            value={`${item.label} ${item.keywords.join(" ")}`}
            onSelect={() => goTo(item.href)}
          >
            <Icon aria-hidden="true" />
            {item.label}
          </CommandItem>
        );
      })}
    </CommandGroup>
  ));
}

function QuickActionsGroup({ run, onSignOut }: { run: RunCommand; onSignOut: () => void }) {
  return (
    <CommandGroup heading="Ações">
      <CommandItem
        value="alternar tema claro escuro"
        onSelect={() => run(() => switchTheme(currentTheme() === "light" ? "dark" : "light"))}
      >
        <SunMoon aria-hidden="true" />
        Alternar tema claro/escuro
      </CommandItem>
      <CommandItem value="sair logout" onSelect={() => run(onSignOut)}>
        <LogOut aria-hidden="true" />
        Sair do painel
      </CommandItem>
    </CommandGroup>
  );
}

/**
 * Command palette (Ctrl/⌘ K): admin navigation, quick actions and search for
 * rooms (code) and participants (name or e-mail, accent-insensitive).
 */
export function CommandPalette({
  groups,
  open,
  onOpenChange,
  onSignOut,
}: {
  groups: NavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const { query, setQuery, term, results, isPending } = usePanelSearch();
  useToggleShortcut(open, onOpenChange);

  function run(action: () => void) {
    onOpenChange(false);
    setQuery("");
    action();
  }

  function goTo(href: string) {
    run(() => {
      void navigate(href, { viewTransition: true });
    });
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar no painel"
      description="Digite para ir a uma tela ou executar uma ação."
    >
      {/* In this shadcn version, the content must be inside <Command> (cmdk context). */}
      <Command>
        <CommandInput
          placeholder="Ir para…, código da sala ou nome de alguém"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{isPending ? "Buscando…" : "Nada encontrado."}</CommandEmpty>
          <SearchResultGroups results={results} term={term} goTo={goTo} />
          <NavigationGroups groups={groups} goTo={goTo} />
          <CommandSeparator />
          <QuickActionsGroup run={run} onSignOut={onSignOut} />
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
