import { data } from "react-router";
import { routeLoader } from "@/server/route-loader.server";
import { getDb } from "@/server/db/index.server";
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
const UNAVAILABLE = "Convite indisponível para esta conta, expirado ou já utilizado.";

/** A broken or used invitation: this page, with its title, answering 404. */
function unavailable<T extends object>(current: T, token: string) {
  const page = { ...current, token, teamName: undefined, role: undefined, verified: false };
  return data({ ...page, error: UNAVAILABLE }, { status: 404 });
}

export const loader = routeLoader(async ({ params }) => {
  const token = params.token ?? "";
  const current = await workspaceUser(`/times/convite/${token}`);
  if (!/^[\w-]{43}$/.test(token)) return unavailable(current, token);
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
    return unavailable(current, token);
  }
});
export default InvitationPage;
