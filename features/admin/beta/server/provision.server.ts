import { eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { proEntitlements, teams } from "@/server/db/schema/workspaces";
import { ActionError } from "@/server/operations/action-error";
import type { AuditRecorder } from "@/server/audit.server";
import { diffChanges } from "@/server/audit.server";
import { lockProSubject } from "@/features/rooms/server/entitlements.server";
import { lockTeam, workspaceAccount } from "@/features/team/server/access.server";
import type { ProvisionInput } from "../domain/provision";

export async function provisionBeta(db: Database, input: ProvisionInput, audit: AuditRecorder) {
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now())
    throw new ActionError("Escolha uma data de expiração futura.");
  return db.transaction(async (tx) => {
    if (input.subject === "account") await workspaceAccount(tx, input.id);
    if (input.subject === "team") {
      await lockTeam(tx, input.id);
      const [team] = await tx.select().from(teams).where(eq(teams.id, input.id));
      if (!team || team.deletedAt) throw new ActionError("Time não encontrado.");
    }
    await lockProSubject(
      tx,
      input.subject === "team" ? { teamId: input.id } : { userId: input.id },
    );
    const target = input.subject === "team" ? proEntitlements.teamId : proEntitlements.userId;
    const [before] = await tx.select().from(proEntitlements).where(eq(target, input.id));
    const values = {
      active: input.active,
      roomLimit: input.roomLimit,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    };
    const [row] = await tx
      .insert(proEntitlements)
      .values({
        ...values,
        userId: input.subject === "account" ? input.id : null,
        teamId: input.subject === "team" ? input.id : null,
      })
      .onConflictDoUpdate({ target, targetWhere: isNotNull(target), set: values })
      .returning();
    if (!row) throw new Error("Beta entitlement was not saved");
    await audit.record(tx, {
      action: "pro.provision",
      resourceType: "pro_entitlement",
      resourceId: row.id,
      changes: diffChanges(before, row),
      metadata: { motivo: input.reason, tipo: input.subject, titular: input.id },
    });
    return { provisioned: true };
  });
}
