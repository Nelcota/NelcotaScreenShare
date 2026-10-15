import { apiLoader } from "@/server/api-route.server";
import { joinRequestState } from "@/features/room/server/join-request-route.server";

export const loader = apiLoader(joinRequestState);
