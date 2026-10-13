import { useRouteLoaderData } from "react-router";
import { AddFriendDialog } from "@/features/friends/ui/AddFriendDialog";
import { FriendGroups } from "@/features/friends/ui/FriendGroups";
import { RequestsButton } from "@/features/friends/ui/RequestsButton";
import { StatusStrip } from "@/features/friends/ui/StatusStrip";
import { ColumnGroups } from "@/features/messages/ui/ColumnGroups";
import { CreateGroupDialog } from "@/features/messages/ui/CreateGroupDialog";
import { AppEmptyState } from "./empty-state";
import type { loader as appLoader } from "./layout";

export const meta = () => [{ title: "Amigos · Nelcota" }, { name: "robots", content: "noindex" }];

/** Phones have no column: the "Amigos" tab shows the list itself. */
function PhoneFriends() {
  const app = useRouteLoaderData<typeof appLoader>("app");
  if (!app) return null;
  return (
    <div className="flex flex-col gap-3 px-3 py-5 sm:hidden">
      <div className="flex items-center gap-3 px-1">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">Amigos</h1>
        <RequestsButton count={app.requests} />
        <CreateGroupDialog friends={app.friends} />
        <AddFriendDialog code={app.code} linkPath={app.linkPath} />
      </div>
      <div className="glass overflow-hidden rounded-2xl [&>div]:border-t-0">
        <StatusStrip account={app.account} status={app.ownStatus} />
      </div>
      <nav aria-label="Seus amigos" className="flex flex-col">
        {app.friends.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">
            Você ainda não tem amigos aqui. Passe seu código para alguém.
          </p>
        ) : (
          <FriendGroups
            friends={app.friends}
            unreadByFriend={app.unreadByFriend}
            before={<ColumnGroups groups={app.groups} />}
          />
        )}
      </nav>
    </div>
  );
}

/** The friends tab with no friend picked: the empty state, or the list on a phone. */
export default function FriendsTab() {
  return (
    <>
      <PhoneFriends />
      <AppEmptyState className="max-sm:hidden" />
    </>
  );
}
