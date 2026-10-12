import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getDb } from "@/server/db/index.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { ActionError } from "@/server/operations/action-error";
import { teamCommandSchema } from "./domain/commands";
import { mutateTeam } from "./server/team-mutations.server";
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
export const teamWorkspaceAction = defineUserOperation(
  { name: "team.change", audit: "required" },
  teamCommandSchema,
  async ({ parsedInput, ctx }) => {
    if (!limiter.hit(ctx.current.user.id).ok)
      throw new ActionError("Muitas alterações. Aguarde um pouco.");
    return mutateTeam(getDb(), ctx.current.user.id, parsedInput, ctx.audit);
  },
);
