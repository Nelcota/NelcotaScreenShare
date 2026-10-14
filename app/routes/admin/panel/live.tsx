import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/features/auth/server/admin-session.server";
import { can } from "@/features/auth/server/permissions.server";
import { ghostRoomIds } from "@/features/admin/live/domain/ghost-rooms";
import { liveKitRoomNames } from "@/features/admin/live/server/livekit-rooms.server";
import { listLiveRooms } from "@/features/admin/live/server/queries.server";
import { LiveRoomCard } from "@/features/admin/live/ui/LiveRoomCard";
import { useAutoRefresh } from "@/features/admin/live/ui/use-auto-refresh";
import { getDb } from "@/server/db/index.server";
import { formatNumber } from "@/lib/format";

export const meta = () => [{ title: "Ao vivo · Nelcota" }];

const REFRESH_MS = 30_000;

export const loader = routeLoader(async () => {
  const admin = await requireAdmin({ live: ["read"] });
  const [rooms, openInLiveKit] = await Promise.all([listLiveRooms(getDb()), liveKitRoomNames()]);
  return {
    rooms,
    ghosts: [...ghostRoomIds(rooms, openInLiveKit)],
    liveKitChecked: openInLiveKit !== null,
    canClose: can(admin.user.role, { live: ["close"] }),
  };
});

export default function AdminLivePage() {
  const { rooms, ghosts, liveKitChecked, canClose } = useLoaderData<typeof loader>();
  useAutoRefresh(REFRESH_MS);
  const ghostSet = new Set(ghosts);
  const people = rooms.reduce((total, room) => total + room.people.length, 0);
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ao vivo</h1>
        <p className="mt-1 text-ink-muted">Quem está em cada sala e desde quando.</p>
      </div>
      {liveKitChecked ? null : (
        <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          O LiveKit não respondeu. Não deu para conferir salas fantasma.
        </p>
      )}
      {rooms.length === 0 ? (
        <p className="panel rounded-2xl p-5 text-ink-muted">Nenhuma chamada agora.</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {formatNumber(rooms.length)} {rooms.length === 1 ? "sala" : "salas"} ·{" "}
            {formatNumber(people)} {people === 1 ? "pessoa" : "pessoas"}
          </p>
          <ul className="grid gap-4 lg:grid-cols-2">
            {rooms.map((room) => (
              <LiveRoomCard
                key={room.id}
                room={room}
                ghost={ghostSet.has(room.id)}
                canClose={canClose}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";
