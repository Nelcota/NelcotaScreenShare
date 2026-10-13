import { Users } from "lucide-react";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { friendPhotoPath } from "@/features/friends/domain/friend-lists";
import type { ConversationItem } from "@/features/messages/domain/conversation-display";
import { cn } from "@/lib/utils";

const AVATAR = "bg-brand/15 font-medium text-brand-soft";

/** The friend's photo with their status, or the people icon for a group. */
export function ConversationAvatar({
  conversation,
  size = "size-9 text-sm",
}: {
  conversation: Pick<ConversationItem, "kind" | "others" | "status">;
  size?: string;
}) {
  const [other] = conversation.others;
  if (conversation.kind === "group" || !other) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full", AVATAR, size)}>
        <Users className="size-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="relative shrink-0">
      <InitialsAvatar
        name={other.name}
        source={friendPhotoPath(other.id)}
        className={cn(AVATAR, size)}
      />
      {conversation.status ? <PresenceDot status={conversation.status} /> : null}
    </span>
  );
}
