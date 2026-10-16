import { desc, eq } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { reports } from "@/server/db/schema";

/**
 * Reports the person filed, for "Baixar meus dados". Only what they wrote and what
 * happened: never who or what was reported beyond its kind.
 */
export function reportsFiledBy(db: DbExecutor, userId: string) {
  return db
    .select({
      tipo: reports.targetKind,
      motivo: reports.reason,
      detalhes: reports.details,
      situacao: reports.status,
      enviada_em: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.reporterId, userId))
    .orderBy(desc(reports.createdAt));
}

/**
 * Anonymization (account deletion included): the details the person wrote and every copy
 * of a message kept in reports they filed or that are about them go; the report records
 * stay, without that text, for moderation history.
 */
export async function forgetReports(tx: DbExecutor, userId: string) {
  await tx
    .update(reports)
    .set({ details: null, messageExcerpt: null })
    .where(eq(reports.reporterId, userId));
  await tx.update(reports).set({ messageExcerpt: null }).where(eq(reports.targetUserId, userId));
}
