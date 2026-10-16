import { apiLoader } from "@/server/api-route.server";
import { openLiveStream } from "@/features/live/server/live-route.server";

export const loader = apiLoader((request) => openLiveStream(request));
