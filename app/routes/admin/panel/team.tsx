import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { listPendingInvitations, listTeam } from "@/features/admin/team/server/queries.server";
import { InviteAdminDialog } from "@/features/admin/team/ui/InviteAdminDialog";
import { PendingInvitations, TeamTable } from "@/features/admin/team/ui/TeamSections";
import { getDb } from "@/server/db/index.server";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

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
      <AdminPageHeader
        title="Equipe"
        description="Quem entra no painel."
        action={<InviteAdminDialog />}
      />
      <TeamTable members={members} youId={youId} />
      <PendingInvitations invitations={invitations} />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
