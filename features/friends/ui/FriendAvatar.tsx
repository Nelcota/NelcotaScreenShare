import { InitialsAvatar } from "@/components/InitialsAvatar";
import { friendPhotoPath, type FriendStatus } from "@/features/friends/domain/friend-lists";
import { SHOWN_STATUS_LABEL, type ShownStatus } from "@/features/friends/domain/presence-status";
import { cn } from "@/lib/utils";

/** The status mark: green, yellow or red, and an empty ring when offline. */
export const STATUS_DOT: Record<ShownStatus, string> = {
  online: "bg-success",
  away: "bg-status-away",
  busy: "bg-danger",
  offline: "border-2 border-ink-subtle bg-surface",
};

/** A friend's photo with the status mark. */
export function FriendAvatar({
  friend,
  size = "size-9 text-sm",
  dot = "size-3 ring-2",
}: {
  friend: FriendStatus;
  size?: string;
  dot?: string;
}) {
  return (
    <span className="relative shrink-0">
      <InitialsAvatar
        name={friend.name}
        source={friendPhotoPath(friend.id)}
        className={cn("bg-brand/15 font-medium text-brand-soft", size)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-0 bottom-0 rounded-full ring-surface",
          dot,
          STATUS_DOT[friend.status],
        )}
      />
    </span>
  );
}

export function presenceLabel(friend: FriendStatus): string {
  return SHOWN_STATUS_LABEL[friend.status];
}
