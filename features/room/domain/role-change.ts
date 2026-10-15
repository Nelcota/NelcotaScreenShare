import { z } from "zod";
import { roomCodeSchema } from "./room-code";
import type { RoomRole } from "./room-role";

/**
 * What the owner changes in other people's roles: make an account a moderator, take that
 * back, or hand the room over (the old owner then stays as a moderator).
 */
const ROLE_CHANGES = ["promote", "demote", "transfer"] as const;

export type RoleChange = (typeof ROLE_CHANGES)[number];

/** Body of POST /api/sala/papel. Only accounts get roles, so the target is an account id. */
export const roleChangeRequestSchema = z.object({
  room: roomCodeSchema,
  userId: z.uuid(),
  change: z.enum(ROLE_CHANGES),
});

export type RoleChangeRefusal = "not_owner" | "self" | "already" | "not_moderator";

/**
 * Whether the owner may apply the change to someone with `target`'s current role. Only the
 * owner changes roles, and never their own.
 */
export function roleChangeRefusal(
  change: RoleChange,
  { actor, target, self }: { actor: RoomRole; target: RoomRole; self: boolean },
): RoleChangeRefusal | undefined {
  if (actor !== "owner") return "not_owner";
  if (self) return "self";
  if (change === "promote" && target === "moderator") return "already";
  if (change === "demote" && target !== "moderator") return "not_moderator";
  return undefined;
}

/** "Sala de Ana": the room's name wherever the code does not need to show. */
export function roomDisplayName(ownerName: string | null | undefined): string | null {
  const name = ownerName?.trim();
  if (!name) return null;
  return `Sala de ${name}`;
}
