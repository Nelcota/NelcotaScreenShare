import { Home, Users, UsersRound, Video } from "lucide-react";
import { NavLink, Outlet, useLoaderData } from "react-router";
import { ParticipantHeader } from "@/components/shell/ParticipantHeader";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { useCloseOnEscape } from "@/features/friends/hooks/use-app-panel";
import { friendsSidebarData } from "@/features/friends/server/friends-sidebar.server";
import type { ColumnTab } from "@/features/friends/ui/FriendsColumn";
import { FriendsSidebar } from "@/features/friends/ui/FriendsSidebar";
import { WorkspaceColumnList } from "@/components/workspace/WorkspaceColumnList";
import { getDb } from "@/server/db/index.server";
import { pageUrl } from "@/server/page-url.server";
import { routeLoader } from "@/server/route-loader.server";
import { columnTabOf, workspaceColumn, type WorkspaceColumn } from "./workspace-column.server";

/**
 * The column's tabs; the messages chat adds its own here. Each tab owns a path: the tab's
 * own route (no item picked) fills the middle (AppEmptyState for Amigos, main's cards for
 * Salas and Times), and each picked item is a child route drawn in the middle.
 */
const COLUMN_TABS: ColumnTab[] = [
  { id: "amigos", label: "Amigos", href: "/amigos" },
  { id: "salas", label: "Salas", href: "/salas" },
  { id: "times", label: "Times", href: "/times" },
];

/** Open before the e-mail is confirmed: /conta to fix the address, and main's workspace. */
function allowsUnverified(pathname: string): boolean {
  return pathname === "/conta" || columnTabOf(pathname) !== "amigos";
}

export const loader = routeLoader(async ({ request }) => {
  const url = pageUrl(request);
  const current = await requireUser(url.pathname + url.search, {
    requireVerified: !allowsUnverified(url.pathname),
  });
  const db = getDb();
  const [sidebar, workspace] = await Promise.all([
    friendsSidebarData(db, current.user, request),
    workspaceColumn(db, current.user.id, url.pathname),
  ]);
  return { ...sidebar, workspace };
});

const TAB =
  "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold text-ink-muted aria-[current=page]:bg-surface-3 aria-[current=page]:text-ink";

/** Phones: the column becomes a tab at the bottom, within reach of the thumb. */
function PhoneTabs({ requests }: { requests: number }) {
  return (
    <nav
      aria-label="App"
      className="glass sticky bottom-3 z-20 mx-3 mb-3 flex gap-1 rounded-2xl p-1.5 sm:hidden"
    >
      <NavLink viewTransition to="/inicio" className={TAB}>
        <Home className="size-5" aria-hidden="true" />
        Início
      </NavLink>
      <NavLink viewTransition to="/amigos" className={TAB}>
        <Users className="size-5" aria-hidden="true" />
        Amigos
        {requests > 0 ? (
          <span className="absolute top-1 left-[calc(50%+0.25rem)] grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] text-canvas">
            {requests}
          </span>
        ) : null}
      </NavLink>
      <NavLink viewTransition to="/salas" className={TAB}>
        <Video className="size-5" aria-hidden="true" />
        Salas
      </NavLink>
      <NavLink viewTransition to="/times" className={TAB}>
        <UsersRound className="size-5" aria-hidden="true" />
        Times
      </NavLink>
    </nav>
  );
}

/** The Salas or Times list in the column; Amigos keeps the friends. */
function WorkspaceTab({ column }: { column: WorkspaceColumn }) {
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

/** The app after sign-in: the friends column on the left and the page in the middle. */
export default function AppLayout() {
  const data = useLoaderData<typeof loader>();
  useCloseOnEscape();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas sm:h-dvh">
      <ParticipantHeader inApp className="shrink-0" />
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 px-3 pt-3 sm:px-6 sm:pb-4">
        <FriendsSidebar
          data={data}
          tabs={COLUMN_TABS}
          activeTab={data.workspace.tab}
          tabContent={
            data.workspace.tab === "amigos" ? undefined : <WorkspaceTab column={data.workspace} />
          }
        />
        <main className="glass min-w-0 flex-1 rounded-3xl sm:overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <PhoneTabs requests={data.requests} />
    </div>
  );
}
