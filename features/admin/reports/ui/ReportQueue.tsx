import { Link } from "react-router";
import { REASON_LABELS, RESOLUTION_LABELS, TARGET_LABELS } from "@/features/reports/domain/reports";
import type { ReportQueueRow } from "@/features/admin/reports/server/queries.server";
import { formatDateTime, formatRelative } from "@/lib/format";

function targetText(row: ReportQueueRow): string {
  const kind = TARGET_LABELS[row.targetKind];
  return row.targetName ? `${kind} · ${row.targetName}` : kind;
}

/** One line per report; each opens its detail. Stacks on a phone. */
export function ReportQueue({ rows }: { rows: ReportQueueRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">Nenhuma denúncia aqui.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            viewTransition
            to={`/admin/denuncias/${row.id}`}
            className="flex flex-col gap-0.5 py-2.5 hover:bg-surface-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="min-w-0">
              <span className="font-medium">{REASON_LABELS[row.reason]}</span>
              <span className="text-ink-muted"> · {targetText(row)}</span>
            </span>
            <span className="shrink-0 text-ink-muted" title={formatDateTime(row.createdAt)}>
              {row.resolution ? `${RESOLUTION_LABELS[row.resolution]} · ` : ""}
              {formatRelative(row.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
