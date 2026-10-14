import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { pageInfo } from "@/components/data-table/page-info";
import { createSerializer } from "nuqs/server";
import { AuditTable } from "@/features/admin/audit/ui/AuditTable";
import { auditFilterOptions, listAuditLogs } from "@/features/admin/audit/server/queries.server";
import { auditParsers, loadAuditParams } from "@/features/admin/audit/domain/search-params";
import { PAGE_SIZE } from "@/lib/table-params";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getDb } from "@/server/db/index.server";

export const meta = () => [{ title: "Auditoria · Nelcota" }];

const serialize = createSerializer(auditParsers);

export const loader = routeLoader(async ({ searchParams }) => {
  const admin = await requireAdmin({ audit: ["read"] });
  const db = getDb();
  const params = loadAuditParams(searchParams);
  const [page, options] = await Promise.all([
    listAuditLogs(db, params, PAGE_SIZE),
    auditFilterOptions(db),
  ]);
  // Exports exactly the on-screen filter (without the current page).
  const exportHref = can(admin.user.role, { audit: ["export"] })
    ? `/api/admin/exportar/auditoria${serialize({ ...params, cursor: null, dir: null })}`
    : null;

  return { page, options, exportHref };
});

export default function AuditPage() {
  const { page, options, exportHref } = useLoaderData<typeof loader>();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-ink-muted">
          Quem fez o quê, quando e de onde. Os registros não podem ser alterados nem apagados.
        </p>
      </div>
      <AuditTable
        rows={page.items}
        page={pageInfo(page)}
        options={options}
        exportHref={exportHref}
      />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
