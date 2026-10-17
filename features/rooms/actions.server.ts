import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getAdminSession } from "@/features/auth/server/admin-session.server";
import { getDb } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";
import { roomWorkspaceSchema } from "./domain/commands";
import { usesReservedWord } from "./domain/room-address";
import { mutateWorkspaceRoom } from "./server/room-mutations.server";
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
export const roomWorkspaceAction = defineUserOperation(
  { name: "permanentRoom.change", audit: "required", allowUnverified: true },
  roomWorkspaceSchema,
  async ({ parsedInput, ctx }) => {
    if (!limiter.hit(ctx.current.user.id).ok)
      throw new ActionError("Muitas alterações. Aguarde um pouco.");
    // Until the owner's list of accounts lands (#366), reserved words need a panel session (2FA).
    const reserved =
      parsedInput.kind === "create" &&
      parsedInput.code !== undefined &&
      usesReservedWord(parsedInput.code);
    const mayUseReservedWords = reserved && (await getAdminSession()) !== null;
    return mutateWorkspaceRoom(getDb(), ctx.current.user.id, parsedInput, ctx.audit, {
      mayUseReservedWords,
    });
  },
);
