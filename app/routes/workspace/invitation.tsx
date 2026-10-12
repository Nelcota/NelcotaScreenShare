import { routeLoader } from "@/server/route-loader.server";
import { getDb } from "@/server/db/index.server";
import { notFound } from "@/server/http.server";
import { ActionError } from "@/server/operations/action-error";
import { workspaceUser } from "@/features/rooms/server/workspace-loader.server";
import { invitationForAccount } from "@/features/team/server/invitations.server";
import { requireMembership } from "@/features/team/server/access.server";
import { InvitationPage } from "@/features/team/ui/InvitationPage";
export const meta = () => [
  { title: "Convite de time · Nelcota" },
  { name: "robots", content: "noindex" },
  { name: "referrer", content: "no-referrer" },
];
export const loader = routeLoader(async ({ params }) => {
  const token = params.token ?? "";
  if (!/^[\w-]{43}$/.test(token)) notFound();
  const current = await workspaceUser(`/times/convite/${token}`);
  try {
    const { invite, account } = await invitationForAccount(getDb(), token, current.actor);
    const creator = await requireMembership(
      getDb(),
      invite.teamId,
      invite.createdBy ?? "",
      "manage",
    );
    return {
      ...current,
      token,
      teamName: creator.team.name,
      role: invite.role,
      verified: account.emailVerified,
      error: undefined,
    };
  } catch (error) {
    if (!(error instanceof ActionError)) throw error;
    return {
      ...current,
      token,
      teamName: undefined,
      role: undefined,
      verified: false,
      error: "Convite indisponível para esta conta, expirado ou já utilizado.",
    };
  }
});
export default InvitationPage;
