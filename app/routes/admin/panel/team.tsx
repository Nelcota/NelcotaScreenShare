import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { listPendingInvitations, listTeam } from "@/features/admin/team/server/queries.server";
import { InviteAdminDialog } from "@/features/admin/team/ui/InviteAdminDialog";
import { PendingInvitations, TeamTable } from "@/features/admin/team/ui/TeamSections";
import { getDb } from "@/server/db/index.server";

export const meta = () => [{ title: "Equipe · Nelcota" }];

export const loader = routeLoader(async () => {
  const admin = await requireAdmin({ user: ["ban"], adminInvitation: ["create"] });
  const db = getDb();
  const [members, invitations] = await Promise.all([listTeam(db), listPendingInvitations(db)]);
  return { members, invitations, youId: admin.user.id };
});

export default function AdminTeamPage() {
  const { members, invitations, youId } = useLoaderData<typeof loader>();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">Equipe</h1>
          <p className="mt-1 text-ink-muted">Quem entra no painel.</p>
        </div>
        <InviteAdminDialog />
      </div>
      <TeamTable members={members} youId={youId} />
      <PendingInvitations invitations={invitations} />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
