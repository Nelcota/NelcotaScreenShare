import { apiLoader } from "@/server/api-route.server";
import { callRoomState } from "@/features/ringing/server/call-room-route.server";

export const loader = apiLoader(callRoomState);
