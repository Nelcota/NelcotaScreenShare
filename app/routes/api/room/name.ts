import { apiAction } from "@/server/api-route.server";
import { setRoomName } from "@/features/room/server/name-route.server";

export const action = apiAction(setRoomName);
