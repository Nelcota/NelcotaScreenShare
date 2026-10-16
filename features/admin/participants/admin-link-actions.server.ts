import { eq } from "drizzle-orm";
import { z } from "zod";
import { withAdminLink } from "@/features/admin/participants/domain/admin-link";
import {
  adminLinkSettings,
  getSetting,
  invalidateSetting,
  saveSetting,
} from "@/features/admin/settings/server/settings.server";
import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { getDb } from "@/server/db/index.server";
import { users } from "@/server/db/schema";
import { ActionError } from "@/server/operations/action-error";

/**
 * Shows or hides "Abrir o painel" in this account's Configurações. Owner only, with a recent
 * sign-in; the panel itself still asks for its own sign-in and the 2FA code.
 */
export const setAdminLinkAction = defineAdminOperation(
  {
    name: "participant.setAdminLink",
    permission: { settings: ["update"] },
    fresh: true,
    audit: "required",
  },
  z.object({ id: z.uuid(), on: z.boolean() }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsedInput.id));
    if (!account) throw new ActionError("Essa conta não existe mais.");
    const before = await getSetting(adminLinkSettings, db);
    const userIds = withAdminLink(before.userIds, parsedInput.id, parsedInput.on);
    await db.transaction(async (tx) => {
      await saveSetting(adminLinkSettings, { userIds }, tx, ctx.admin.user.id);
      await ctx.audit.record(tx, {
        action: "user.admin_link",
        resourceType: "user",
        resourceId: parsedInput.id,
        metadata: { ligado: parsedInput.on },
      });
    });
    invalidateSetting(adminLinkSettings.key);
    return { on: parsedInput.on };
  },
);
