import { useLoaderData } from "react-router";
import { routeLoader } from "@/server/route-loader.server";
import {
  workspaceUser,
  workspaceId,
  loadRoomHistory,
} from "@/features/rooms/server/workspace-loader.server";
import { RoomHistory } from "@/features/rooms/ui/RoomHistory";
export const meta = () => [
  { title: "Histórico da sala · Nelcota" },
  { name: "robots", content: "noindex" },
];
export const loader = routeLoader(async ({ params, searchParams }) => {
  const roomId = workspaceId(params.id);
  const current = await workspaceUser(`/salas/${roomId}`);
  return { ...current, ...(await loadRoomHistory(current.actor, roomId, searchParams.antes)) };
});
export default function HistoryPage() {
  return <RoomHistory {...useLoaderData<typeof loader>()} />;
}
