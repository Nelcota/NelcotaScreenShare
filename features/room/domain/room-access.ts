import { z } from "zod";
import type { RoomRole } from "./room-role";

/** "open": anyone with the link joins; "approval": everyone but the owner and moderators asks. */
export const ROOM_ACCESS_MODES = ["open", "approval"] as const;
export const roomAccessSchema = z.enum(ROOM_ACCESS_MODES);
export type RoomAccess = z.infer<typeof roomAccessSchema>;

export const ROOM_ACCESS_LABEL: Record<RoomAccess, string> = {
  open: "Entrada livre",
  approval: "Com aprovação",
};

export const ROOM_ACCESS_HINT: Record<RoomAccess, string> = {
  open: "Quem tem o link entra direto.",
  approval: "Você ou um moderador aceita cada pessoa.",
};

/** A request waits this long for an answer. */
export const JOIN_REQUEST_WAIT_MS = 2 * 60_000;
/** An accepted request lets the person in once, within this time. */
export const JOIN_APPROVAL_VALID_MS = 5 * 60_000;

export const JOIN_REQUEST_STATUSES = ["pending", "accepted", "declined", "expired"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

/** The owner and moderators choose how people get in (and let them in). */
export function managesRoomAccess(role: RoomRole): boolean {
  return role === "owner" || role === "moderator";
}
