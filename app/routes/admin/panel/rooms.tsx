import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { pageInfo } from "@/components/data-table/page-info";
import { createSerializer } from "nuqs/server";
import { RoomsTable } from "@/features/admin/rooms/ui/RoomsTable";
import { listRooms } from "@/features/admin/rooms/server/queries.server";
import { loadRoomParams, roomParsers } from "@/features/admin/rooms/domain/search-params";
import { PAGE_SIZE } from "@/lib/table-params";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { getDb } from "@/server/db/index.server";

export const meta = () => [{ title: "Salas · Nelcota" }];

const serialize = createSerializer(roomParsers);

export const loader = routeLoader(async ({ searchParams }) => {
  const admin = await requireAdmin({ room: ["read"] });
  const db = getDb();
  const params = loadRoomParams(searchParams);
  const page = await listRooms(db, params, PAGE_SIZE);
  const role = admin.user.role;

  const canDelete = can(role, { room: ["delete"] });
  const canExport = can(role, { room: ["export"] });
  return { params, page, canDelete, canExport };
});

export default function RoomsPage() {
  const { params, page, canDelete, canExport } = useLoaderData<typeof loader>();
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salas</h1>
        <p className="mt-1 text-ink-muted">
          Toda sala aberta no LiveKit, com quem entrou e o que foi compartilhado.
        </p>
      </div>
      <RoomsTable
        rows={page.items}
        page={pageInfo(page)}
        canDelete={canDelete}
        exportHref={
          canExport
            ? `/api/admin/exportar/salas${serialize({ ...params, cursor: null, dir: null })}`
            : null
        }
      />
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
