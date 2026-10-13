import { Link } from "react-router";
import { REASON_LABELS } from "@/features/admin/entries/domain/reasons";
import type { DenialRow } from "@/features/admin/entries/server/queries.server";
import { formatDateTime } from "@/lib/format";

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
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-ink-subtle">
          <tr>
            <th className="py-2 pr-4 font-medium">Quando</th>
            <th className="py-2 pr-4 font-medium">Motivo</th>
            <th className="py-2 pr-4 font-medium">Sala</th>
            <th className="py-2 font-medium">Pessoa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
              <td className="py-2 pr-4">{REASON_LABELS[row.reason]}</td>
              <td className="py-2 pr-4">
                <Room code={row.roomCode} />
              </td>
              <td className="py-2 text-ink-muted">
                <Person row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
