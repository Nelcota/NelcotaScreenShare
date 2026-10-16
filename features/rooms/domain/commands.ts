import { z } from "zod";
import { BLOCKED_TERM_MESSAGE, hasBlockedTerm } from "@/features/moderation/domain/blocked-terms";
import { roomAddressSchema } from "./room-address";

/** A room or team name: public, so it may not carry a blocked term. */
export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Use pelo menos 2 caracteres.")
  .max(80)
  .refine((name) => !hasBlockedTerm(name), BLOCKED_TERM_MESSAGE);
const id = z.object({ roomId: z.uuid() });
export const roomWorkspaceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    name: workspaceNameSchema,
    /** Chosen address (#388); without it, one is drawn. */
    code: roomAddressSchema.optional(),
    teamId: z.uuid().optional(),
    allowGuests: z.boolean(),
    memberCanHost: z.boolean(),
  }),
  id.extend({
    kind: z.literal("edit"),
    name: workspaceNameSchema,
    allowGuests: z.boolean(),
    memberCanHost: z.boolean(),
  }),
  id.extend({ kind: z.literal("archive"), archived: z.boolean() }),
  id.extend({ kind: z.literal("favorite"), favorite: z.boolean() }),
]);
export type RoomWorkspaceCommand = z.infer<typeof roomWorkspaceSchema>;
