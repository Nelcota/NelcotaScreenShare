import { routeLoader } from "@/server/route-loader.server";
import { Link, useLoaderData } from "react-router";

import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { listReports } from "@/features/admin/reports/server/queries.server";
import { ReportQueue } from "@/features/admin/reports/ui/ReportQueue";
import { getDb } from "@/server/db/index.server";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Denúncias · Nelcota" }];

export const loader = routeLoader(async ({ searchParams }) => {
  await requireAdmin({ report: ["read"] });
  const status = searchParams.situacao === "resolvidas" ? "resolved" : "open";
  return { status, ...(await listReports(getDb(), status)) };
});

function Tab({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link
      viewTransition
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1 text-sm",
        active ? "bg-surface-3 font-medium text-ink" : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export default function AdminReportsPage() {
  const { status, rows, open } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader
        title="Denúncias"
        description={open === 0 ? "Nenhuma denúncia aberta." : `${open} para avaliar.`}
      />
      <nav className="flex gap-1" aria-label="Situação">
        <Tab to="/admin/denuncias" active={status === "open"}>
          Abertas
        </Tab>
        <Tab to="/admin/denuncias?situacao=resolvidas" active={status === "resolved"}>
          Resolvidas
        </Tab>
      </nav>
      <div className="panel rounded-2xl px-4 py-1 sm:px-5">
        <ReportQueue rows={rows} />
      </div>
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
