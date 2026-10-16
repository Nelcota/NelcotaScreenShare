import { Link } from "react-router";
import { REASON_LABELS } from "@/features/admin/entries/domain/reasons";
import type { DenialRow } from "@/features/admin/entries/server/queries.server";
import { formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function Person({ row }: { row: DenialRow }) {
  if (!row.userId) return <>Sem conta</>;
  return (
    <Link viewTransition to={`/admin/usuarios/${row.userId}`} className="hover:underline">
      {row.userName ?? "Participante"}
    </Link>
  );
}

function Room({ code }: { code: string }) {
  return (
    <Link
      viewTransition
      to={`/admin/salas?q=${encodeURIComponent(code)}`}
      className="font-sans tabular-nums hover:underline"
    >
      {code}
    </Link>
  );
}

/** Phone width: one stacked item per denial. */
function StackedDenials({ rows }: { rows: DenialRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line text-sm sm:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-0.5 py-2">
          <span className="font-medium">{REASON_LABELS[row.reason]}</span>
          <span className="text-ink-muted">
            {formatDateTime(row.createdAt)} · <Room code={row.roomCode} />
          </span>
          <span className="text-ink-muted">
            <Person row={row} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function DenialsTable({ rows }: { rows: DenialRow[] }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Sala</TableHead>
            <TableHead>Pessoa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDateTime(row.createdAt)}</TableCell>
              <TableCell className="whitespace-normal">{REASON_LABELS[row.reason]}</TableCell>
              <TableCell className="whitespace-normal">
                <Room code={row.roomCode} />
              </TableCell>
              <TableCell className="whitespace-normal text-ink-muted">
                <Person row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The latest denied joins: when, why, which room and who. */
export function DenialsList({ rows }: { rows: DenialRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">Nada por aqui.</p>;
  return (
    <>
      <StackedDenials rows={rows} />
      <DenialsTable rows={rows} />
    </>
  );
}
