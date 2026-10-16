import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { pageInfo } from "@/components/data-table/page-info";
import { createSerializer } from "nuqs/server";
import { ParticipantsTable } from "@/features/admin/participants/ui/ParticipantsTable";
import { listParticipants } from "@/features/admin/participants/server/queries.server";
import {
  loadParticipantParams,
  participantParsers,
} from "@/features/admin/participants/domain/search-params";
import { PAGE_SIZE } from "@/lib/table-params";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getDb } from "@/server/db/index.server";
import { AdminPageHeader } from "@/features/admin/shell/ui/AdminPageHeader";

export const meta = () => [{ title: "Participantes · Nelcota" }];

const serialize = createSerializer(participantParsers);

export const loader = routeLoader(async ({ searchParams }) => {
  const admin = await requireAdmin({ participant: ["read"] });
  const db = getDb();
  const params = loadParticipantParams(searchParams);
  const page = await listParticipants(db, params, PAGE_SIZE);
  const role = admin.user.role;

  const canUpdate = can(role, { participant: ["update"] });
  const canDelete = can(role, { participant: ["delete"] });
  const canExport = can(role, { participant: ["export"] });
  return { params, page, canUpdate, canDelete, canExport };
});

export default function ParticipantsPage() {
  const { params, page, canUpdate, canDelete, canExport } = useLoaderData<typeof loader>();
  return (
    <>
      <AdminPageHeader title="Participantes" description="Contas de quem entra nas salas." />
      <ParticipantsTable
        rows={page.items}
        page={pageInfo(page)}
        can={{
          update: canUpdate,
          delete: canDelete,
        }}
        exportHref={
          canExport
            ? `/api/admin/exportar/usuarios${serialize({ ...params, cursor: null, dir: null })}`
            : null
        }
      />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
