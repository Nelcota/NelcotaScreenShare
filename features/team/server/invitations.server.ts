import { createHash, randomBytes } from "node:crypto";
import { count, and, eq, gt, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { teamInvitations, teamMembers } from "@/server/db/schema/workspaces";
import { users } from "@/server/db/schema/user-auth";
import { ActionError } from "@/server/operations/action-error";
import { appUrl } from "@/server/env.server";
import { lockTeam, requireMembership, workspaceAccount } from "./access.server";
import { requireEntitlement } from "@/features/rooms/server/entitlements.server";

function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function createTeamInvitation(
  tx: DbExecutor,
  teamId: string,
  actor: string,
  email: string,
  role: "manager" | "member",
) {
  await requireEntitlement(tx, { teamId });
  const [existing] = await tx
    .select({ id: teamMembers.userId })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(eq(teamMembers.teamId, teamId), sql`lower(${users.email}) = ${email.toLowerCase()}`),
    );
  if (existing)
    throw new ActionError(
      "Esta pessoa já faz parte do time. Altere sua função na lista de membros.",
    );
  const [pending] = await tx
    .select({ total: count() })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        isNull(teamInvitations.usedAt),
        isNull(teamInvitations.revokedAt),
        gt(teamInvitations.expiresAt, new Date()),
      ),
    );
  if ((pending?.total ?? 0) >= 200)
    throw new ActionError(
      "Revogue convites pendentes antes de criar mais. O piloto permite até 200 convites ativos por time.",
    );
  const token = randomBytes(32).toString("base64url");
  const [invite] = await tx
    .insert(teamInvitations)
    .values({
      teamId,
      email: email.toLowerCase(),
      role,
      tokenHash: invitationHash(token),
      createdBy: actor,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    })
    .returning({ id: teamInvitations.id });
  if (!invite) throw new Error("Team invitation was not saved");
  return { invitationId: invite.id, invitationLink: `${appUrl()}/times/convite/${token}` };
}
export async function invitationForAccount(tx: DbExecutor, token: string, actor: string) {
  const account = await workspaceAccount(tx, actor);
  const [invite] = await tx
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.tokenHash, invitationHash(token)));
  if (
    !invite ||
    invite.usedAt ||
    invite.revokedAt ||
    invite.expiresAt.getTime() <= Date.now() ||
    invite.email !== account.email.toLowerCase()
  )
    throw new ActionError("Convite indisponível para esta conta, expirado ou já utilizado.");
  if (!invite.createdBy)
    throw new ActionError("Convite indisponível para esta conta, expirado ou já utilizado.");
  await requireMembership(tx, invite.teamId, invite.createdBy, "manage");
  return { invite, account };
}
export async function acceptTeamInvitation(tx: DbExecutor, token: string, actor: string) {
  const initial = await invitationForAccount(tx, token, actor);
  await lockTeam(tx, initial.invite.teamId);
  const { invite, account } = await invitationForAccount(tx, token, actor);
  if (!account.emailVerified)
    throw new ActionError("Confirme o e-mail desta conta antes de aceitar o convite.");
  await requireEntitlement(tx, { teamId: invite.teamId });
  const [existing] = await tx
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, invite.teamId), eq(teamMembers.userId, actor)));
  if (existing) throw new ActionError("Você já faz parte deste time.");
  const [size] = await tx
    .select({ total: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, invite.teamId));
  if ((size?.total ?? 0) >= 100)
    throw new ActionError("O piloto permite até 100 membros por time.");
  await tx.insert(teamMembers).values({ teamId: invite.teamId, userId: actor, role: invite.role });
  await tx
    .update(teamInvitations)
    .set({ usedAt: new Date(), acceptedBy: actor })
    .where(and(eq(teamInvitations.id, invite.id), isNull(teamInvitations.usedAt)));
  return { teamId: invite.teamId, invitationId: invite.id };
}

export async function revokeTeamInvitation(tx: DbExecutor, teamId: string, invitationId: string) {
  const changed = await tx
    .update(teamInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.teamId, teamId),
        isNull(teamInvitations.usedAt),
        isNull(teamInvitations.revokedAt),
      ),
    )
    .returning({ id: teamInvitations.id });
  if (!changed.length) throw new ActionError("Convite não encontrado ou já utilizado/revogado.");
}
