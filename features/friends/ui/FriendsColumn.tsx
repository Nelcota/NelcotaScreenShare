import { PanelLeftClose, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { Hint } from "@/components/Hint";
import { AddFriendDialog } from "@/features/friends/ui/AddFriendDialog";
import { COLUMN_SHORTCUT } from "@/features/friends/domain/column-layout";
import { FriendGroups } from "@/features/friends/ui/FriendGroups";
import { RequestsButton } from "@/features/friends/ui/RequestsButton";
import { cn } from "@/lib/utils";

/** A tab at the top of the column: Amigos, Salas and Times; "Mensagens" will join them. */
export interface ColumnTab {
  id: string;
  label: string;
  href: string;
}

function ColumnTabs({ tabs, activeId }: { tabs: ColumnTab[]; activeId: string }) {
  const [only] = tabs;
  if (tabs.length === 1 && only) {
    return <h2 className="px-1 text-lg font-semibold tracking-tight">{only.label}</h2>;
  }
  return (
    <nav
      aria-label="Coluna"
      className="flex gap-1 rounded-full border border-line bg-surface-2 p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          viewTransition
          to={tab.href}
          aria-current={tab.id === activeId ? "page" : undefined}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-full text-sm font-semibold text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-surface-3 aria-[current=page]:text-ink aria-[current=page]:ring-1 aria-[current=page]:ring-line-strong"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Accents and case do not matter in the search. */
function searchable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function CollapseButton({ onCollapse }: { onCollapse: () => void }) {
  return (
    <Hint text="Recolher amigos" shortcut={COLUMN_SHORTCUT.toUpperCase()}>
      <button
        type="button"
        aria-label="Recolher amigos"
        aria-keyshortcuts={COLUMN_SHORTCUT.toUpperCase()}
        onClick={onCollapse}
        className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
      >
        <PanelLeftClose className="size-4" aria-hidden="true" />
      </button>
    </Hint>
  );
}

function FriendsBody({
  friends,
  requests,
  code,
  linkPath,
}: {
  friends: FriendStatus[];
  requests: number;
  code: string;
  linkPath: string;
}) {
  const [query, setQuery] = useState("");
  const wanted = searchable(query.trim());
  const shown = wanted
    ? friends.filter((friend) => searchable(friend.name).includes(wanted))
    : friends;
  return (
    <>
      <div className="mt-3 flex items-center gap-2 px-3">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 focus-within:border-brand-soft">
          <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <span className="sr-only">Buscar amigo</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar amigo"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
          />
        </label>
        <RequestsButton count={requests} />
        <AddFriendDialog code={code} linkPath={linkPath} />
      </div>
      <nav aria-label="Amigos" className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-3">
        {friends.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">
            Você ainda não tem amigos aqui. Passe seu código para alguém.
          </p>
        ) : (
          <FriendGroups friends={shown} />
        )}
      </nav>
    </>
  );
}

/**
 * The column: tabs on top, then the friends (search, requests, "Adicionar amigo") or, for
 * another tab, the list it brings in `children`.
 */
export function FriendsColumn({
  tabs,
  activeTab,
  friends,
  requests,
  code,
  linkPath,
  onCollapse,
  children,
  className,
}: {
  tabs: ColumnTab[];
  activeTab: string;
  friends: FriendStatus[];
  requests: number;
  code: string;
  linkPath: string;
  onCollapse: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <ColumnTabs tabs={tabs} activeId={activeTab} />
        </div>
        <CollapseButton onCollapse={onCollapse} />
      </div>
      {children ?? (
        <FriendsBody friends={friends} requests={requests} code={code} linkPath={linkPath} />
      )}
    </div>
  );
}
