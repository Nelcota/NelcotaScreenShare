import { apiAction } from "@/server/api-route.server";
import { changeRoomRole } from "@/features/room/server/role-change-route.server";

export const action = apiAction((request) => changeRoomRole(request));
