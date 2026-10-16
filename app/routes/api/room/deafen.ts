import { apiAction } from "@/server/api-route.server";
import { setDeafened } from "@/features/room/server/deafen-route.server";

export const action = apiAction(setDeafened);
