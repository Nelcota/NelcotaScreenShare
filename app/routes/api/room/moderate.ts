import { apiAction } from "@/server/api-route.server";
import { moderateRoom } from "@/features/room/server/moderation-route.server";

export const action = apiAction((request) => moderateRoom(request));
