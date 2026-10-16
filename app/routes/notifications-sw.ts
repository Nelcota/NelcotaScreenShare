import { apiLoader } from "@/server/api-route.server";
import { notificationsWorker } from "@/features/notifications/server/notifications-worker.server";

export const loader = apiLoader(notificationsWorker);
