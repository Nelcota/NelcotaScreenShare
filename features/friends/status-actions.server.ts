import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { PRESENCE_STATUSES } from "@/features/friends/domain/presence-status";
import { nudgeStatusChange } from "@/features/friends/server/friend-nudges.server";
import { saveStatus } from "@/features/friends/server/presence-status.server";
import { getDb } from "@/server/db/index.server";

/** Picks your own status; it applies on every device you use. */
export const setPresenceStatus = defineUserOperation(
  { name: "friends.status", audit: "none" },
  z.object({ status: z.enum(PRESENCE_STATUSES) }),
  async ({ parsedInput, ctx }) => {
    await saveStatus(getDb(), ctx.current.user.id, parsedInput.status);
    await nudgeStatusChange(getDb(), ctx.current.user.id);
    return { status: parsedInput.status };
  },
);
