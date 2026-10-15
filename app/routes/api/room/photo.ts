import { apiLoader } from "@/server/api-route.server";
import { participantPhoto } from "@/features/room/server/photo-route.server";

export const loader = apiLoader(participantPhoto);
