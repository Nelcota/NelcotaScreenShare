import { z } from "zod";
export const workspaceNameSchema = z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(80);
const id = z.object({ roomId: z.uuid() });
export const roomWorkspaceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    name: workspaceNameSchema,
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
