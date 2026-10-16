import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { pageInfo } from "@/components/data-table/page-info";
import { createSerializer } from "nuqs/server";
import { SharesTable } from "@/features/admin/shares/ui/SharesTable";
import { listShares } from "@/features/admin/shares/server/queries.server";
import { loadShareParams, shareParsers } from "@/features/admin/shares/domain/search-params";
import { PAGE_SIZE } from "@/lib/table-params";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getDb } from "@/server/db/index.server";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Compartilhamentos · Nelcota" }];

const serialize = createSerializer(shareParsers);

export const loader = routeLoader(async ({ searchParams }) => {
  const admin = await requireAdmin({ shareSession: ["read"] });
  const db = getDb();
  const params = loadShareParams(searchParams);
  const page = await listShares(db, params, PAGE_SIZE);

  const canExport = can(admin.user.role, { shareSession: ["export"] });
  return { params, page, canExport };
});

export default function SharesPage() {
  const { params, page, canExport } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader
        title="Compartilhamentos"
        description="Cada vez que alguém compartilhou a tela numa sala."
      />
      <SharesTable
        rows={page.items}
        page={pageInfo(page)}
        exportHref={
          canExport
            ? `/api/admin/exportar/compartilhamentos${serialize({ ...params, cursor: null, dir: null })}`
            : null
        }
      />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
