import { StatusBadge } from "@/components/StatusBadge";
import { reasonLabel, STATUS_LABELS } from "@/features/admin/mail/domain/labels";
import type { DeliveryRow } from "@/features/admin/mail/server/queries.server";
import { formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function Status({ row }: { row: DeliveryRow }) {
  const status = STATUS_LABELS[row.status];
  return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
}

/** Phone width: one stacked item per delivery instead of a table that scrolls sideways. */
function DeliveriesList({ rows }: { rows: DeliveryRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line text-sm sm:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-0.5 py-2">
          <span className="flex items-start justify-between gap-2">
            <span className="font-medium">{row.subject}</span>
            <Status row={row} />
          </span>
          <span className="text-ink-muted">
            {formatDateTime(row.createdAt)} · {row.recipientDomain ?? "—"}
          </span>
          {row.reason ? <span className="text-ink-muted">{reasonLabel(row.reason)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function DeliveriesGrid({ rows }: { rows: DeliveryRow[] }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Para</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDateTime(row.createdAt)}</TableCell>
              <TableCell className="whitespace-normal">{row.subject}</TableCell>
              <TableCell className="whitespace-normal text-ink-muted">
                {row.recipientDomain ?? "—"}
              </TableCell>
              <TableCell className="whitespace-normal">
                <Status row={row} />
              </TableCell>
              <TableCell className="whitespace-normal text-ink-muted">
                {reasonLabel(row.reason)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The latest deliveries: what was sent, where to (domain only) and whether it was accepted. */
export function DeliveriesTable({ rows }: { rows: DeliveryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhum e-mail enviado nos últimos 30 dias.</p>;
  }
  return (
    <>
      <DeliveriesList rows={rows} />
      <DeliveriesGrid rows={rows} />
    </>
  );
}
