import { z } from "zod";
import { roomCodeSchema } from "./room-code";
import type { RoomRole } from "./room-role";

/**
 * Removing someone from a call. Kick only disconnects (they can join again); ban also
 * refuses new tokens until this call ends (see room-bans.server).
 */
const MODERATION_ACTIONS = ["kick", "ban"] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/**
 * The owner removes anyone else; a moderator removes participants only, never the owner or
 * another moderator. Nobody removes themselves: their own role is never below their own.
 */
export function canModerate(actor: RoomRole, target: RoomRole): boolean {
  if (actor === "owner") return target !== "owner";
  if (actor === "moderator") return target === "participant";
  return false;
}

/** Body of POST /api/sala/moderar. */
export const moderationRequestSchema = z.object({
  room: roomCodeSchema,
  identity: z.string().min(1).max(128),
  action: z.enum(MODERATION_ACTIONS),
});
