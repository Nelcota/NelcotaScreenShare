import { apiLoader } from "@/server/api-route.server";
import { friendPhoto } from "@/features/friends/server/friend-photo-route.server";

export const loader = apiLoader(friendPhoto);
