import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { auditLogs } from "@/server/db/schema";

const CHANGES_IN_EXPORT: Record<string, string> = {
  "user.photo_remove": "Foto removida",
  "user.name_reset": "Nome redefinido",
};

/** Photo and name changes the team made to the account, with the reason sent by e-mail. */
export async function profileChangesOf(db: DbExecutor, userId: string) {
  const rows = await db
    .select({
      action: auditLogs.action,
      motivo: sql<string | null>`${auditLogs.metadata}->>'motivo'`,
      quando: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.resourceType, "user"),
        eq(auditLogs.resourceId, userId),
        inArray(auditLogs.action, Object.keys(CHANGES_IN_EXPORT)),
      ),
    )
    .orderBy(desc(auditLogs.createdAt));
  return rows.map(({ action, motivo, quando }) => ({
    alteracao: CHANGES_IN_EXPORT[action] ?? action,
    motivo,
    quando,
  }));
}
