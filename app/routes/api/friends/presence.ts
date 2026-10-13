import { apiAction } from "@/server/api-route.server";
import { recordPresence } from "@/features/friends/server/presence-route.server";

export const action = apiAction(recordPresence);
