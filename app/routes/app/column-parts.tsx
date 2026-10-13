import { Home, MessageCircle, Users, UsersRound, Video } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { WorkspaceColumnList } from "@/components/workspace/WorkspaceColumnList";
import type { ColumnTab } from "@/features/friends/ui/FriendsColumn";
import type { PickableFriend } from "@/features/messages/ui/NewConversationDialog";
import { ConversationList } from "@/features/messages/ui/ConversationList";
import type { WorkspaceColumn } from "./workspace-column.server";

/**
 * The column's tabs. Each tab owns a path: the tab's own route (no item picked) fills the
 * middle (AppEmptyState for Amigos and Mensagens, main's cards for Salas and Times), and each
 * picked item is a child route drawn in the middle.
 */
export function columnTabs(counts: { requests: number; unread: number }): ColumnTab[] {
  return [
    { id: "amigos", label: "Amigos", href: "/amigos", icon: Users, badge: counts.requests },
    {
      id: "mensagens",
      label: "Mensagens",
      href: "/mensagens",
      icon: MessageCircle,
      badge: counts.unread,
    },
    { id: "salas", label: "Salas", href: "/salas", icon: Video },
    { id: "times", label: "Times", href: "/times", icon: UsersRound },
  ];
}

const TAB =
  "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold text-ink-muted aria-[current=page]:bg-surface-3 aria-[current=page]:text-ink";

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="absolute top-1 left-[calc(50%+0.25rem)] grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] text-canvas">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function PhoneTab({
  to,
  icon,
  label,
  count = 0,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <NavLink viewTransition to={to} className={TAB}>
      {icon}
      {label}
      <Count value={count} />
    </NavLink>
  );
}

/** Phones: the column becomes tabs at the bottom, within reach of the thumb. */
export function PhoneTabs({ requests, unread }: { requests: number; unread: number }) {
  const icon = "size-5";
  return (
    <nav
      aria-label="App"
      className="glass sticky bottom-3 z-20 mx-3 mb-3 flex gap-1 rounded-2xl p-1.5 sm:hidden"
    >
      <PhoneTab to="/inicio" icon={<Home className={icon} aria-hidden="true" />} label="Início" />
      <PhoneTab
        to="/amigos"
        icon={<Users className={icon} aria-hidden="true" />}
        label="Amigos"
        count={requests}
      />
      <PhoneTab
        to="/mensagens"
        icon={<MessageCircle className={icon} aria-hidden="true" />}
        label="Mensagens"
        count={unread}
      />
      <PhoneTab to="/salas" icon={<Video className={icon} aria-hidden="true" />} label="Salas" />
      <PhoneTab
        to="/times"
        icon={<UsersRound className={icon} aria-hidden="true" />}
        label="Times"
      />
    </nav>
  );
}

/** The list of the open tab in the column; Amigos keeps the friends. */
export function TabContent({
  column,
  friends,
  selfId,
}: {
  column: WorkspaceColumn;
  friends: PickableFriend[];
  selfId: string;
}) {
  if (column.tab === "mensagens") {
    return (
      <ConversationList conversations={column.conversations} friends={friends} selfId={selfId} />
    );
  }
  if (column.tab === "salas") {
    const items = column.rooms.map((room) => ({ ...room, href: `/salas/${room.id}` }));
    return (
      <WorkspaceColumnList
        kind="room"
        items={items}
        searchLabel="Buscar sala"
        empty="Nenhuma sala aqui."
      />
    );
  }
  if (column.tab === "times") {
    const items = column.teams.map((team) => ({
      id: team.id,
      name: team.name,
      href: `/times/${team.id}`,
    }));
    return (
      <WorkspaceColumnList
        kind="team"
        items={items}
        searchLabel="Buscar time"
        empty="Você ainda não está em nenhum time."
      />
    );
  }
  return null;
}
