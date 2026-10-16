import { apiLoader } from "@/server/api-route.server";
import { exportCsv } from "@/features/admin/waitlist/server/csv-export.server";

export const loader = apiLoader(exportCsv);
