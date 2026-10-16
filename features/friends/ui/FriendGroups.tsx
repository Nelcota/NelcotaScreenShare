import { useId, type ReactNode } from "react";
import { NavLink } from "react-router";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { splitByPresence, type FriendStatus } from "@/features/friends/domain/friend-lists";
import { FriendAvatar, presenceLabel } from "@/features/friends/ui/FriendAvatar";
import { FriendMenu } from "@/features/friends/ui/FriendMenu";
import { IconCallButton } from "@/features/ringing/ui/CallButton";
import { cn } from "@/lib/utils";

const GROUP_TITLE = "px-2 pt-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase";

const ROW =
  "group relative flex items-center rounded-2xl transition-colors hover:bg-surface-3 has-[a[aria-current=page]]:bg-surface-3";

const ROW_LINK =
  "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-brand";

function unreadLabel(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? ", 1 mensagem nova" : `, ${count} mensagens novas`;
}

/**
 * One friend: opens the conversation with them; "Chamar" and "…" show on hover or focus
 * (always on touch screens). Unread messages show on the photo.
 */
function FriendLine({ friend, unread }: { friend: FriendStatus; unread: number }) {
  return (
    <li className={ROW}>
      <NavLink
        viewTransition
        to={`/amigos/${friend.id}/conversa`}
        aria-label={`${friend.name}${unreadLabel(unread)}`}
        className={ROW_LINK}
      >
        <FriendAvatar friend={friend} unread={unread} />
        <span className={cn("min-w-0 flex-1", friend.status === "offline" && "opacity-70")}>
          <span className="block truncate text-sm font-semibold">{friend.name}</span>
          <span className="block text-xs text-ink-muted">{presenceLabel(friend)}</span>
        </span>
      </NavLink>
      <span className="hidden items-center gap-1 pr-1.5 group-focus-within:flex group-hover:flex has-[[data-state=open]]:flex pointer-coarse:flex">
        {friend.status === "offline" ? null : <IconCallButton friend={friend} />}
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

/** Friends split into Online and Offline, after what the page puts first (the groups). */
export function FriendGroups({
  friends,
  unreadByFriend = {},
  before,
}: {
  friends: FriendStatus[];
  unreadByFriend?: Readonly<Record<string, number>>;
  before?: ReactNode;
}) {
  const onlineId = useId();
  const offlineId = useId();
  const { online, offline } = splitByPresence(friends);
  const unreadOf = (friend: FriendStatus) => unreadByFriend[friend.id] ?? 0;
  return (
    <>
      {before}
      {/* Labels, not headings: the column comes before the page's h1. */}
      <p id={onlineId} className={GROUP_TITLE}>
        Online · {online.length}
      </p>
      {online.length === 0 ? <NobodyOnline /> : null}
      <ul aria-labelledby={onlineId} className="mt-1 flex flex-col gap-0.5">
        {online.map((friend) => (
          <FriendLine key={friend.id} friend={friend} unread={unreadOf(friend)} />
        ))}
      </ul>
      {offline.length > 0 ? (
        <>
          <p id={offlineId} className={cn(GROUP_TITLE, "pt-4")}>
            Offline · {offline.length}
          </p>
          <ul aria-labelledby={offlineId} className="mt-1 flex flex-col gap-0.5">
            {offline.map((friend) => (
              <FriendLine key={friend.id} friend={friend} unread={unreadOf(friend)} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
