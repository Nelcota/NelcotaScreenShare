import { z } from "zod";
import { roomCodeSchema } from "./room-code";

export const sharePolicySchema = z.enum(["everyone", "host", "selected"]);
export type SharePolicy = z.infer<typeof sharePolicySchema>;

export const roomControlInputSchema = z.object({
  room: roomCodeSchema,
  sessionId: z.uuid(),
});

export const hostCommandSchema = z.discriminatedUnion("kind", [
  roomControlInputSchema.extend({ kind: z.literal("lock"), locked: z.boolean() }),
  roomControlInputSchema.extend({
    kind: z.literal("remove"),
    identity: z.string().min(1).max(128),
  }),
  roomControlInputSchema.extend({ kind: z.literal("transfer"), identity: z.uuid() }),
  roomControlInputSchema.extend({ kind: z.literal("close") }),
  roomControlInputSchema.extend({
    kind: z.literal("sharing"),
    policy: sharePolicySchema,
    allowed: z.array(z.string().min(1).max(128)).max(8),
  }),
]);
export type HostCommand = z.infer<typeof hostCommandSchema>;
export const hostCommandKindSchema = z.enum(["lock", "sharing", "remove", "transfer", "close"]);
type CommandIntent<T> = T extends HostCommand ? Omit<T, "room" | "sessionId"> : never;
export type HostIntent = CommandIntent<HostCommand>;

export const roomControlStateSchema = z.object({
  sessionId: z.uuid(),
  hostIdentity: z.string().nullable(),
  permanent: z.boolean(),
  isHost: z.boolean(),
  /** Host commands this person may give: all for the host or owner, some for a moderator. */
  commands: z.array(hostCommandKindSchema),
  /** Whether ending the call also closes the room for good (an ownerless ad hoc room). */
  endsRoom: z.boolean(),
  locked: z.boolean(),
  policy: sharePolicySchema,
  allowed: z.array(z.string()),
  canShare: z.boolean(),
  closed: z.boolean(),
  removed: z.boolean(),
  pending: z.boolean(),
  failed: z.boolean(),
});
export type RoomControlState = z.infer<typeof roomControlStateSchema>;

export function mayShareScreen(
  identity: string,
  hostIdentity: string | null,
  policy: SharePolicy,
  allowed: readonly string[],
): boolean {
  if (identity === hostIdentity) return true;
  if (policy === "everyone") return true;
  return policy === "selected" && allowed.includes(identity);
}

export const HOST_RECONNECT_GRACE_MS = 60_000;
export const ADMISSION_LEASE_MS = 60_000;

/** Cached credentials do not override current admission state. */
export function admissionRefusal({
  closed,
  excluded,
  locked,
  admitted,
}: {
  closed: boolean;
  excluded: boolean;
  locked: boolean;
  admitted: boolean;
}) {
  if (closed) return "room_closed" as const;
  if (excluded) return "room_removed" as const;
  if (locked && !admitted) return "room_locked" as const;
  return undefined;
}
