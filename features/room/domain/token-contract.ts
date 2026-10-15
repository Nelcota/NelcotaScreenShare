import { z } from "zod";
import { displayNameSchema } from "./participant-label";
import { roomCodeSchema } from "./room-code";

/**
 * Body of POST /api/token, the same in the browser and on the server. With an account,
 * the name and identity come from it (server); a guest sends only the name to show.
 */
export const tokenRequestSchema = z.object({
  room: roomCodeSchema,
  password: z.string().max(128).optional(),
  /** Dashboard invite token (?convite= in the room link). */
  invite: z.string().max(64).optional(),
  /** Name of a guest (no account); ignored when the request comes with a session. */
  guestName: displayNameSchema.optional(),
  /** An accepted request to enter a room with approval (it lets the person in once). */
  requestId: z.uuid().optional(),
});

export type TokenRequest = z.infer<typeof tokenRequestSchema>;

export const tokenResponseSchema = z.object({
  token: z.string(),
  serverUrl: z.string(),
  sessionId: z.uuid().optional(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const tokenErrorSchema = z.object({
  error: z.enum([
    "invalid_request",
    "unauthenticated",
    "email_unverified",
    "blocked",
    "cross_site",
    "invalid_password",
    "invite_invalid",
    "room_full",
    "host_absent",
    "room_not_found",
    "banned",
    "awaiting_approval",
    "room_locked",
    "room_removed",
    "room_closed",
    "rate_limited",
    "server_error",
  ]),
  message: z.string(),
  /** With awaiting_approval: the request to follow while the owner decides. */
  requestId: z.string().optional(),
});

export type TokenErrorCode = z.infer<typeof tokenErrorSchema>["error"];
