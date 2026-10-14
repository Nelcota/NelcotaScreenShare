import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { Download } from "lucide-react";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getWaitlist } from "@/features/admin/waitlist/server/queries.server";
import { WaitlistTable } from "@/features/admin/waitlist/ui/WaitlistTable";
import { getDb } from "@/server/db/index.server";
import { formatNumber } from "@/lib/format";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Lista de espera do Pro · Nelcota" }];

export const loader = routeLoader(async () => {
  const admin = await requireAdmin({ participant: ["read"] });
  return {
    ...(await getWaitlist(getDb())),
    canExport: can(admin.user.role, { participant: ["export"] }),
  };
});

function ExportButton() {
  return (
    <Button asChild variant="outline" size="sm">
      <a href="/api/admin/exportar/lista-pro" download>
        <Download aria-hidden="true" />
        Exportar CSV
      </a>
    </Button>
  );
}

export default function AdminWaitlistPage() {
  const { total, latest, canExport } = useLoaderData<typeof loader>();
  const people = total === 1 ? "1 pessoa" : `${formatNumber(total)} pessoas`;
  return (
    <>
      <AdminPageHeader
        title="Lista de espera do Pro"
        description={<>{people} pediram aviso quando o Pro sair.</>}
      />
      <Section
        title={total > latest.length ? `Últimas ${latest.length}` : "Inscrições"}
        action={canExport && total > 0 ? <ExportButton /> : null}
      >
        <WaitlistTable rows={latest} />
      </Section>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
