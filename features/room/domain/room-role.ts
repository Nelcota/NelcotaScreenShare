/**
 * Roles in a room. The owner is the account that created the room through "Criar sala"; the
 * owner makes other accounts moderators. Both are saved per room code, so they survive
 * reconnections and the room reopening. Everyone else, guests included, is a participant.
 */
const ROOM_ROLES = ["owner", "moderator", "participant"] as const;

export type RoomRole = (typeof ROOM_ROLES)[number];

/** Roles saved in the database: being a participant is the absence of a row. */
export const SAVED_ROOM_ROLES = ["owner", "moderator"] as const satisfies readonly RoomRole[];

/** Participant attribute with the role, written by the server (token and RoomService). */
export const ROLE_ATTRIBUTE = "role";

/** Role read from a participant's attributes; anything unknown counts as participant. */
export function parseRoomRole(value: string | undefined): RoomRole {
  if (value === undefined) return "participant";
  const known = ROOM_ROLES.find((role) => role === value);
  return known ?? "participant";
}
