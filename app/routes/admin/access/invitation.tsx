import { TimerOff } from "lucide-react";
import { useLoaderData, type LoaderFunctionArgs, Link } from "react-router";
import { withRequest } from "@/server/request-context.server";
import { routeAction } from "@/server/route-loader.server";
import { acceptInvitation } from "@/features/auth/actions.server";
import { invitationFromForm } from "@/features/auth/server/native-auth-actions.server";
import { AcceptInvitationForm } from "@/features/auth/ui/AcceptInvitationForm";
import { AuthCard } from "@/features/auth/ui/AuthCard";
import { Button } from "@/components/ui/button";
import { findPendingInvitation } from "@/features/auth/server/admin-invitations.server";
import { ADMIN_ROLE_LABELS, isAdminRole } from "@/features/auth/domain/roles";
import { getDb } from "@/server/db/index.server";

export const loader = ({ request, params, context }: LoaderFunctionArgs) =>
  withRequest(request, context, async () => {
    const db = getDb();
    const token = params.token ?? "";
    const invitation = token.length <= 200 ? await findPendingInvitation(db, token) : undefined;
    if (!invitation || !isAdminRole(invitation.role)) return { invitation: null, token };
    return {
      invitation: { email: invitation.email, roleLabel: ADMIN_ROLE_LABELS[invitation.role] },
      token,
    };
  });

/** The form posted without JS. */
export const action = routeAction(({ request, params }) =>
  invitationFromForm(request, acceptInvitation, { token: params.token ?? "" }),
);

export default function AcceptInvitationPage() {
  const { invitation, token } = useLoaderData<typeof loader>();

  if (!invitation) {
    return (
      <AuthCard
        icon={TimerOff}
        title="Convite indisponível"
        description="Este convite expirou, foi revogado ou já foi usado. Peça um novo a quem convidou você."
      >
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link viewTransition to="/admin/entrar">
            Entrar no painel
          </Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AcceptInvitationForm token={token} email={invitation.email} roleLabel={invitation.roleLabel} />
  );
}
