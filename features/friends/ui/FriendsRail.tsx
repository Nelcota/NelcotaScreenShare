import { PanelLeftOpen } from "lucide-react";
import { Hint } from "@/components/Hint";
import { splitByPresence, type FriendStatus } from "@/features/friends/domain/friend-lists";
import type { PresenceStatus } from "@/features/friends/domain/presence-status";
import { AddFriendDialog } from "@/features/friends/ui/AddFriendDialog";
import { COLUMN_SHORTCUT } from "@/features/friends/domain/column-layout";
import { RailFriendMenu } from "@/features/friends/ui/RailFriendMenu";
import { RequestsButton } from "@/features/friends/ui/RequestsButton";
import { StatusStrip } from "@/features/friends/ui/StatusStrip";
import { Button } from "@/components/ui/button";

function RailFriend({ friend, unread }: { friend: FriendStatus; unread: number }) {
  return (
    <li>
      <RailFriendMenu friend={friend} unread={unread} />
    </li>
  );
}

/** The collapsed column: open it, requests, "Adicionar amigo" and who is online. */
export function FriendsRail({
  friends,
  unreadByFriend,
  requests,
  code,
  linkPath,
  account,
  ownStatus,
  onExpand,
}: {
  friends: FriendStatus[];
  /** Unread messages by friend, shown on their photo. */
  unreadByFriend: Readonly<Record<string, number>>;
  requests: number;
  code: string;
  linkPath: string;
  account: { name: string; image: string | null };
  ownStatus: PresenceStatus;
  onExpand: () => void;
}) {
  const { online } = splitByPresence(friends);
  const key = COLUMN_SHORTCUT.toUpperCase();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <div className="flex flex-col items-center gap-2 pt-3">
        <Hint text="Abrir amigos" shortcut={key}>
          <Button
            type="button"
            variant="quiet"
            size="icon-lg"
            aria-label="Abrir amigos"
            aria-keyshortcuts={key}
            onClick={onExpand}
            className="border-line-strong"
          >
            <PanelLeftOpen aria-hidden="true" />
          </Button>
        </Hint>
        <RequestsButton count={requests} />
        <AddFriendDialog code={code} linkPath={linkPath} />
      </div>
      <span aria-hidden="true" className="my-3 h-px w-7 shrink-0 bg-line" />
      <ul
        aria-label="Amigos online"
        className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto pb-2"
      >
        {online.map((friend) => (
          <RailFriend key={friend.id} friend={friend} unread={unreadByFriend[friend.id] ?? 0} />
        ))}
      </ul>
      <StatusStrip account={account} status={ownStatus} compact />
    </div>
  );
}
