import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { proEntitlements } from "@/server/db/schema/workspaces";
import { ActionError } from "@/server/operations/action-error";
export type ProSubject = { userId: string } | { teamId: string };

function subjectColumn(subject: ProSubject) {
  return "teamId" in subject
    ? eq(proEntitlements.teamId, subject.teamId)
    : eq(proEntitlements.userId, subject.userId);
}
export async function entitlement(db: DbExecutor, subject: ProSubject, now = new Date()) {
  const [row] = await db
    .select()
    .from(proEntitlements)
    .where(
      and(
        subjectColumn(subject),
        eq(proEntitlements.active, true),
        or(isNull(proEntitlements.expiresAt), gt(proEntitlements.expiresAt, now)),
      ),
    );
  return { active: Boolean(row), roomLimit: row?.roomLimit ?? 0 };
}
export async function requireEntitlement(db: DbExecutor, subject: ProSubject) {
  const pro = await entitlement(db, subject);
  if (!pro.active) throw new ActionError("Este recurso precisa de Pro beta ativo.");
  return pro;
}
export async function lockProSubject(db: DbExecutor, subject: ProSubject) {
  const key = "teamId" in subject ? `team:${subject.teamId}` : `user:${subject.userId}`;
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`nelcota:pro:${key}`}, 0))`);
}
