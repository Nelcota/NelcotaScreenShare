import { z } from "zod";
import { workspaceNameSchema } from "@/features/rooms/domain/commands";
const team = z.object({ teamId: z.uuid() });
export const teamCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), name: workspaceNameSchema }),
  team.extend({ kind: z.literal("rename"), name: workspaceNameSchema }),
  team.extend({
    kind: z.literal("invite"),
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    role: z.enum(["manager", "member"]),
  }),
  team.extend({ kind: z.literal("revoke"), invitationId: z.uuid() }),
  team.extend({ kind: z.literal("role"), userId: z.uuid(), role: z.enum(["manager", "member"]) }),
  team.extend({ kind: z.literal("transfer"), userId: z.uuid() }),
  team.extend({ kind: z.literal("remove"), userId: z.uuid() }),
  team.extend({ kind: z.literal("delete") }),
  z.object({ kind: z.literal("accept"), token: z.string().regex(/^[\w-]{43}$/) }),
]);
export type TeamCommand = z.infer<typeof teamCommandSchema>;
