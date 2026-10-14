import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { TwoFactorSettings } from "@/features/security/ui/TwoFactorSettings";
import { needsTwoFactorSetup, requireAdmin } from "@/features/auth/server/admin-session.server";
import { ROLES_REQUIRING_2FA } from "@/features/auth/domain/roles";
import { Notice } from "@/components/Notice";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Segurança da conta · Nelcota" }];

export const loader = routeLoader(async () => {
  // The only panel page reachable without 2FA: it is where 2FA is set up.
  const admin = await requireAdmin(undefined, { allowWithoutTwoFactor: true });
  const mustSetUp = needsTwoFactorSetup(admin);

  return { admin: { user: admin.user }, mustSetUp };
});

export default function AccountSecurityPage() {
  const { admin, mustSetUp } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader title="Segurança da conta" description={admin.user.email} />
      {mustSetUp ? (
        <Notice as="output" tone="warning">
          Para usar o painel, ative a verificação em duas etapas.
        </Notice>
      ) : null}
      <TwoFactorSettings
        scope="admin"
        doneHref="/admin"
        enabled={admin.user.twoFactorEnabled}
        required={ROLES_REQUIRING_2FA.includes(admin.user.role)}
      />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
