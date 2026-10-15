import { useParticipantAttribute } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { parseRoomRole, ROLE_ATTRIBUTE, type RoomRole } from "@/features/room/domain/room-role";

const ROLE_BADGES: Partial<Record<RoomRole, string>> = { owner: "Dono", moderator: "Moderador" };

/** "Dono" or "Moderador" next to a name, following role changes live; participants have none. */
export function RoleBadge({ participant }: { participant: Participant }) {
  const role = parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant }));
  const badge = ROLE_BADGES[role];
  if (!badge) return null;
  return (
    <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-soft">
      {badge}
    </span>
  );
}
