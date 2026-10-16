import { eq } from "drizzle-orm";
import { withAdminLink } from "@/features/admin/participants/domain/admin-link";
import {
  adminLinkSettings,
  getSetting,
  saveSetting,
} from "@/features/admin/settings/server/settings.server";
import { getDb, type Database, type DbExecutor } from "@/server/db/index.server";
import { appSettings } from "@/server/db/schema";

/** Whether this app account shows "Abrir o painel" in Configurações (the owner's list). */
export async function hasAdminLink(userId: string, db: Database = getDb()): Promise<boolean> {
  const { userIds } = await getSetting(adminLinkSettings, db);
  return userIds.includes(userId);
}

/**
 * Turns the link on or off for one account inside the caller's transaction. The row is
 * created if missing and locked before reading, so two owners changing the list at once
 * never drop each other's change.
 */
export async function setAdminLink(
  tx: DbExecutor,
  userId: string,
  on: boolean,
  updatedBy: string,
): Promise<void> {
  await tx
    .insert(appSettings)
    .values({ key: adminLinkSettings.key, value: adminLinkSettings.defaults })
    .onConflictDoNothing();
  const [row] = await tx
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, adminLinkSettings.key))
    .for("update");
  const current = adminLinkSettings.schema.safeParse(row?.value);
  const userIds = withAdminLink(current.success ? current.data.userIds : [], userId, on);
  await saveSetting(adminLinkSettings, { userIds }, tx, updatedBy);
}
