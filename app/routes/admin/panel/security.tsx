import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { TwoFactorSettings } from "@/features/security/ui/TwoFactorSettings";
import { needsTwoFactorSetup, requireAdmin } from "@/features/auth/server/admin-session.server";
import { ROLES_REQUIRING_2FA } from "@/features/auth/domain/roles";
import { Notice } from "@/components/Notice";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Segurança da conta</h1>
        <p className="mt-1 text-ink-muted">{admin.user.email}</p>
      </div>
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
