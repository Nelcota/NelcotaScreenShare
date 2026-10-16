import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getDb } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";
import { roomWorkspaceSchema } from "./domain/commands";
import { mutateWorkspaceRoom } from "./server/room-mutations.server";
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
export const roomWorkspaceAction = defineUserOperation(
  { name: "permanentRoom.change", audit: "required", allowUnverified: true },
  roomWorkspaceSchema,
  async ({ parsedInput, ctx }) => {
    if (!limiter.hit(ctx.current.user.id).ok)
      throw new ActionError("Muitas alterações. Aguarde um pouco.");
    return mutateWorkspaceRoom(getDb(), ctx.current.user.id, parsedInput, ctx.audit);
  },
);
