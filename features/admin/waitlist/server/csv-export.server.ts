import { csvExportRoute } from "@/features/admin/shell/server/csv-export-route.server";
import { iterateWaitlist } from "./queries.server";

/** Pro launch list CSV (requires `participant.export`: these are personal e-mails). */
export const exportCsv = csvExportRoute({
  permission: { participant: ["export"] },
  audit: { action: "pro_interest.export", resourceType: "pro_interest" },
  filename: "lista-de-espera-pro",
  header: ["email", "entrou_em"],
  loadParams: () => ({ cursor: null, dir: null }),
  rows: (db) => iterateWaitlist(db),
  toCells: (row) => [row.email, row.createdAt],
});
