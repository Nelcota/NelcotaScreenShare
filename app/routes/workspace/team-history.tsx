import { useLoaderData } from "react-router";
import { routeLoader } from "@/server/route-loader.server";
import {
  workspaceUser,
  workspaceId,
  loadRoomHistory,
} from "@/features/rooms/server/workspace-loader.server";
import { RoomHistory } from "@/features/rooms/ui/RoomHistory";
import { skipClientOnlyChanges } from "@/app/revalidation";
export const meta = () => [
  { title: "Chamadas do time · Nelcota" },
  { name: "robots", content: "noindex" },
];
/** The room filter and ?atendeu are read in the browser: changing them reloads nothing. */
export const shouldRevalidate = skipClientOnlyChanges;

export const loader = routeLoader(async ({ params, searchParams }) => {
  const teamId = workspaceId(params.id);
  const roomId = workspaceId(params.roomId);
  const current = await workspaceUser(`/times/${teamId}/salas/${roomId}`);
  return {
    ...current,
    ...(await loadRoomHistory(current.actor, roomId, searchParams.antes, teamId)),
  };
});
export default function TeamHistoryPage() {
  return <RoomHistory {...useLoaderData<typeof loader>()} />;
}
