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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lista de espera do Pro</h1>
        <p className="mt-1 text-ink-muted">{people} pediram aviso quando o Pro sair.</p>
      </div>
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
