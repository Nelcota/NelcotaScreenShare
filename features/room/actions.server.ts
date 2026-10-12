import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";
import { hostCommandSchema } from "./domain/host-controls";
import { executeHostCommand } from "./server/host-command.server";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export const hostCommandAction = defineUserOperation(
  { name: "room.hostCommand", audit: "required" },
  hostCommandSchema,
  async ({ parsedInput, ctx }) => {
    if (!getEnv().ROOM_HOST_CONTROLS_ENABLED)
      throw new ActionError("Os controles do anfitrião ainda não estão disponíveis.");
    if (!limiter.hit(ctx.current.user.id).ok)
      throw new ActionError("Muitas alterações seguidas. Aguarde um pouco.");
    return executeHostCommand(getDb(), ctx.current.user.id, parsedInput, ctx.audit);
  },
);
