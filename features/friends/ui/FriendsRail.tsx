import { PanelLeftOpen } from "lucide-react";
import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "@/app/root";
import { Hint } from "@/components/Hint";
import { splitByPresence, type FriendStatus } from "@/features/friends/domain/friend-lists";
import type { PresenceStatus } from "@/features/friends/domain/presence-status";
import { AddFriendDialog } from "@/features/friends/ui/AddFriendDialog";
import { COLUMN_SHORTCUT } from "@/features/friends/domain/column-layout";
import { RailFriendMenu } from "@/features/friends/ui/RailFriendMenu";
import { RequestsButton } from "@/features/friends/ui/RequestsButton";
import { StatusStrip } from "@/features/friends/ui/StatusStrip";

function RailFriend({ friend }: { friend: FriendStatus }) {
  const outgoing = useRouteLoaderData<typeof rootLoader>("root")?.ringing?.outgoing ?? [];
  const ringing = outgoing.find((ring) => ring.calleeId === friend.id && ring.state === "ringing");
  return (
    <li>
      <RailFriendMenu friend={friend} ringId={ringing?.id ?? null} />
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
