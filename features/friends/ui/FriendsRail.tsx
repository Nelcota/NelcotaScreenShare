import { PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router";
import { Hint } from "@/components/Hint";
import { splitByPresence, type FriendStatus } from "@/features/friends/domain/friend-lists";
import type { PresenceStatus } from "@/features/friends/domain/presence-status";
import { useToggleLink } from "@/features/friends/hooks/use-app-panel";
import { AddFriendDialog } from "@/features/friends/ui/AddFriendDialog";
import { FriendAvatar } from "@/features/friends/ui/FriendAvatar";
import { COLUMN_SHORTCUT } from "@/features/friends/domain/column-layout";
import { RequestsButton } from "@/features/friends/ui/RequestsButton";
import { StatusStrip } from "@/features/friends/ui/StatusStrip";

function RailFriend({ friend }: { friend: FriendStatus }) {
  const path = `/amigos/${friend.id}`;
  const toggle = useToggleLink(path);
  return (
    <li>
      <Hint text={friend.name}>
        <NavLink
          viewTransition
          to={path}
          onClick={toggle.onClick}
          aria-label={friend.name}
          className="grid size-11 place-items-center rounded-2xl transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand aria-[current=page]:bg-surface-3"
        >
          <FriendAvatar friend={friend} />
        </NavLink>
      </Hint>
    </li>
  );
}

/** The collapsed column: open it, requests, "Adicionar amigo" and who is online. */
export function FriendsRail({
  friends,
  requests,
  code,
  linkPath,
  account,
  ownStatus,
  onExpand,
}: {
  friends: FriendStatus[];
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
          <button
            type="button"
            aria-label="Abrir amigos"
            aria-keyshortcuts={key}
            onClick={onExpand}
            className="grid size-9 place-items-center rounded-full border border-line-strong text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          </button>
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
          <RailFriend key={friend.id} friend={friend} />
        ))}
      </ul>
      <StatusStrip account={account} status={ownStatus} compact />
    </div>
  );
}
