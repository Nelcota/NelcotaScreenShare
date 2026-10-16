import { NavLink } from "react-router";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { splitByPresence, type FriendStatus } from "@/features/friends/domain/friend-lists";
import { FriendAvatar, presenceLabel } from "@/features/friends/ui/FriendAvatar";
import { FriendMenu } from "@/features/friends/ui/FriendMenu";
import { cn } from "@/lib/utils";

const GROUP_TITLE = "px-2 pt-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase";

/**
 * One friend: opens the conversation with them; "Chamar" and "…" show on hover or focus
 * (always on touch screens). Their profile sits beside the conversation.
 */
function FriendLine({ friend }: { friend: FriendStatus }) {
  return (
    <li className="group relative flex items-center rounded-2xl transition-colors hover:bg-surface-3 has-[a[aria-current=page]]:bg-surface-3">
      <NavLink
        viewTransition
        to={`/amigos/${friend.id}/conversa`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <FriendAvatar friend={friend} />
        <span className={cn("min-w-0 flex-1", friend.status === "offline" && "opacity-70")}>
          <span className="block truncate text-sm font-semibold">{friend.name}</span>
          <span className="block text-xs text-ink-muted">{presenceLabel(friend)}</span>
        </span>
      </NavLink>
      <span className="flex items-center pr-1.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <FriendMenu person={friend} />
      </span>
    </li>
  );
}

function NobodyOnline() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <Mascot className="size-20" sizes="160px" expression="sleepy" canSleep={false} />
      <p className="text-sm text-ink-muted">Nenhum amigo online agora</p>
    </div>
  );
}

/** Friends split into Online and Offline. */
export function FriendGroups({ friends }: { friends: FriendStatus[] }) {
  const { online, offline } = splitByPresence(friends);
  return (
    <>
      <h2 className={GROUP_TITLE}>Online — {online.length}</h2>
      {online.length === 0 ? <NobodyOnline /> : null}
      <ul className="mt-1 flex flex-col gap-0.5">
        {online.map((friend) => (
          <FriendLine key={friend.id} friend={friend} />
        ))}
      </ul>
      {offline.length > 0 ? (
        <>
          <h2 className={cn(GROUP_TITLE, "pt-4")}>Offline — {offline.length}</h2>
          <ul className="mt-1 flex flex-col gap-0.5">
            {offline.map((friend) => (
              <FriendLine key={friend.id} friend={friend} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
