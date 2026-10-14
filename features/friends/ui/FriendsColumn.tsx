import { PanelLeftClose, Search, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { Hint } from "@/components/Hint";
import { UnreadCount } from "@/components/UnreadCount";
import { AddFriendDialog } from "@/features/friends/ui/AddFriendDialog";
import { COLUMN_SHORTCUT } from "@/features/friends/domain/column-layout";
import { FriendGroups } from "@/features/friends/ui/FriendGroups";
import { RequestsButton } from "@/features/friends/ui/RequestsButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** A tab at the top of the column: Amigos, Salas and Times. */
export interface ColumnTab {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Unread or pending items, shown as a count on the tab. */
  badge?: number;
}

/** The open tab shows its name; the others only their icon, named in the hint. */
function TabLink({ tab, active }: { tab: ColumnTab; active: boolean }) {
  const Icon = tab.icon;
  const badge = tab.badge ?? 0;
  const label = badge > 0 ? `${tab.label}: ${badge}` : tab.label;
  return (
    <Hint text={active ? undefined : tab.label}>
      <Link
        viewTransition
        to={tab.href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex h-8 items-center justify-center gap-1 rounded-full text-sm font-semibold text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-surface-3 aria-[current=page]:text-ink aria-[current=page]:ring-1 aria-[current=page]:ring-line-strong",
          active ? "min-w-0 flex-1 px-1.5" : "w-8 shrink-0",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {active ? <span className="truncate">{tab.label}</span> : null}
        <UnreadCount
          count={badge}
          aria-hidden="true"
          className={active ? "static ring-0" : undefined}
        />
      </Link>
    </Hint>
  );
}

function ColumnTabs({ tabs, activeId }: { tabs: ColumnTab[]; activeId: string }) {
  return (
    <nav
      aria-label="Coluna"
      className="flex w-full min-w-0 gap-0.5 rounded-full border border-line bg-surface-2 p-1"
    >
      {tabs.map((tab) => (
        <TabLink key={tab.id} tab={tab} active={tab.id === activeId} />
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
      <Button
        type="button"
        variant="quiet"
        size="icon"
        aria-label="Recolher amigos"
        aria-keyshortcuts={COLUMN_SHORTCUT.toUpperCase()}
        onClick={onCollapse}
      >
        <PanelLeftClose aria-hidden="true" />
      </Button>
    </Hint>
  );
}

/** What another feature adds to the friends list; the page that draws the column composes it. */
export interface ColumnExtras {
  /** Unread messages by friend, on their photo. */
  unreadByFriend: Readonly<Record<string, number>>;
  /** Beside "Adicionar amigo": "Criar grupo". */
  actions?: ReactNode;
  /** Above the friends while nobody is searching: "Grupos". */
  groups?: ReactNode;
}

function FriendsBody({
  friends,
  extras,
  requests,
  code,
  linkPath,
}: {
  friends: FriendStatus[];
  extras: ColumnExtras;
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
            placeholder="Buscar"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
          />
        </label>
        <RequestsButton count={requests} />
        {extras.actions}
        <AddFriendDialog code={code} linkPath={linkPath} />
      </div>
      <nav aria-label="Amigos" className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-3">
        {friends.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">
            Você ainda não tem amigos aqui. Passe seu código para alguém.
          </p>
        ) : (
          <FriendGroups
            friends={shown}
            unreadByFriend={extras.unreadByFriend}
            before={wanted ? null : extras.groups}
          />
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
  extras,
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
  extras: ColumnExtras;
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
        <FriendsBody
          friends={friends}
          extras={extras}
          requests={requests}
          code={code}
          linkPath={linkPath}
        />
      )}
    </div>
  );
}
