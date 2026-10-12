import { apiAction, apiLoader } from "@/server/api-route.server";
import { annotationRequest } from "@/features/room/server/annotations.server";

export const loader = apiLoader(annotationRequest);
export const action = apiAction(annotationRequest);
