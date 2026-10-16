import { routeLoader } from "@/server/route-loader.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { workspaceUser } from "@/features/rooms/server/workspace-loader.server";
import { workspaceRooms } from "@/features/rooms/server/queries.server";
import { entitlement } from "@/features/rooms/server/entitlements.server";
import { MyRoomsPage } from "@/features/rooms/ui/MyRoomsPage";
import { skipClientOnlyChanges } from "@/app/revalidation";
export const meta = () => [
  { title: "Minhas salas · Nelcota" },
  { name: "robots", content: "noindex" },
];
/** The room filter and ?atendeu are read in the browser: changing them reloads nothing. */
export const shouldRevalidate = skipClientOnlyChanges;

export const loader = routeLoader(async () => {
  const current = await workspaceUser("/salas");
  return {
    ...current,
    rooms: await workspaceRooms(getDb(), current.actor),
    pro: await entitlement(getDb(), { userId: current.actor }),
    enabled: getEnv().ROOM_HOST_CONTROLS_ENABLED,
  };
});
export default MyRoomsPage;
