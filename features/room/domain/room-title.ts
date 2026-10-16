import { roomDisplayName } from "@/features/room/domain/role-change";

/**
 * The name the call shows for a room. A permanent room keeps its own ("Daily do time"); a
 * one-off room is "Sala de Ana" and follows a new owner live.
 */
export interface RoomTitle {
  text: string;
  followsOwner: boolean;
}

export function roomTitle(
  definition: { kind: string; name: string | null } | undefined,
  ownerName: string | null,
): RoomTitle | null {
  const ownName = definition?.kind === "ad_hoc" ? undefined : definition?.name?.trim();
  if (ownName) return { text: ownName, followsOwner: false };
  const text = roomDisplayName(ownerName);
  if (!text) return null;
  return { text, followsOwner: true };
}
