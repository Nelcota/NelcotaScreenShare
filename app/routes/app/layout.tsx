import { Outlet, useLoaderData } from "react-router";
import { ParticipantHeader } from "@/components/shell/ParticipantHeader";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { useCloseOnEscape } from "@/features/friends/hooks/use-app-panel";
import { friendsSidebarData } from "@/features/friends/server/friends-sidebar.server";
import { FriendsSidebar } from "@/features/friends/ui/FriendsSidebar";
import { useMessageNotifications } from "@/features/messages/hooks/use-message-notifications";
import { unreadSummary } from "@/features/messages/server/conversation-list.server";
import { getDb } from "@/server/db/index.server";
import { pageUrl } from "@/server/page-url.server";
import { routeLoader } from "@/server/route-loader.server";
import { columnTabs, PhoneTabs, TabContent } from "./column-parts";
import { columnTabOf, workspaceColumn } from "./workspace-column.server";

/** Open before the e-mail is confirmed: /conta to fix the address, and main's workspace. */
function allowsUnverified(pathname: string): boolean {
  const tab = columnTabOf(pathname);
  return pathname === "/conta" || tab === "salas" || tab === "times";
}

export const loader = routeLoader(async ({ request }) => {
  const url = pageUrl(request);
  const current = await requireUser(url.pathname + url.search, {
    requireVerified: !allowsUnverified(url.pathname),
  });
  const db = getDb();
  const [sidebar, workspace, unread] = await Promise.all([
    friendsSidebarData(db, current.user, request),
    workspaceColumn(db, current.user.id, url.pathname),
    unreadSummary(db, current.user.id),
  ]);
  return { ...sidebar, workspace, unread, selfId: current.user.id };
});

/** The app after sign-in: the column on the left and the page in the middle. */
export default function AppLayout() {
  const data = useLoaderData<typeof loader>();
  useCloseOnEscape();
  useMessageNotifications(data.unread.latest);
  const counts = { requests: data.requests, unread: data.unread.total };
  return (
    // A page marked data-phone-fill (an open conversation) keeps the phone screen fixed and
    // scrolls inside, so its bottom bar stays above the tabs.
    <div className="flex min-h-dvh flex-col bg-canvas has-[[data-phone-fill]]:h-dvh sm:h-dvh">
      <ParticipantHeader inApp className="shrink-0" />
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 px-3 pt-3 sm:px-6 sm:pb-4">
        <FriendsSidebar
          data={data}
          tabs={columnTabs(counts)}
          activeTab={data.workspace.tab}
          tabContent={
            data.workspace.tab === "amigos" ? undefined : (
              <TabContent column={data.workspace} friends={data.friends} selfId={data.selfId} />
            )
          }
        />
        <main className="glass min-w-0 flex-1 rounded-3xl has-[[data-phone-fill]]:overflow-hidden sm:overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <PhoneTabs requests={counts.requests} unread={counts.unread} />
    </div>
  );
}
