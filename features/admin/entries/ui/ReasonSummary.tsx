import { Link } from "react-router";
import { REASON_LABELS, type DenialReason } from "@/features/admin/entries/domain/reasons";
import type { ReasonCount } from "@/features/admin/entries/server/queries.server";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Denials per reason; a row filters the list below. */
export function ReasonSummary({
  counts,
  selected,
}: {
  counts: ReasonCount[];
  selected: DenialReason | null;
}) {
  if (counts.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhuma entrada negada nos últimos 7 dias.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Motivo</TableHead>
          <TableHead className="text-right">24 h</TableHead>
          <TableHead className="text-right">7 dias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {counts.map((row) => {
          const active = row.reason === selected;
          return (
            <TableRow key={row.reason} className={cn(active && "bg-surface-2")}>
              <TableCell className="whitespace-normal">
                <Link
                  viewTransition
                  to={active ? "?" : `?motivo=${row.reason}`}
                  aria-current={active ? "true" : undefined}
                  className="hover:underline"
                >
                  {REASON_LABELS[row.reason]}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.lastDay)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(row.lastWeek)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
