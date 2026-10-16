import { adminLinkSettings, getSetting } from "@/features/admin/settings/server/settings.server";
import { getDb, type Database } from "@/server/db/index.server";

/** Whether this app account shows "Abrir o painel" in Configurações (the owner's list). */
export async function hasAdminLink(userId: string, db: Database = getDb()): Promise<boolean> {
  const { userIds } = await getSetting(adminLinkSettings, db);
  return userIds.includes(userId);
}
