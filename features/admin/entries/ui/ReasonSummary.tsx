import { Link } from "react-router";
import { REASON_LABELS, type DenialReason } from "@/features/admin/entries/domain/reasons";
import type { ReasonCount } from "@/features/admin/entries/server/queries.server";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-ink-subtle">
        <tr>
          <th className="py-2 pr-4 font-medium">Motivo</th>
          <th className="py-2 pr-4 text-right font-medium">24 h</th>
          <th className="py-2 text-right font-medium">7 dias</th>
        </tr>
      </thead>
      <tbody>
        {counts.map((row) => {
          const active = row.reason === selected;
          return (
            <tr key={row.reason} className={cn("border-t border-line", active && "bg-surface-2")}>
              <td className="py-2 pr-4">
                <Link
                  viewTransition
                  to={active ? "?" : `?motivo=${row.reason}`}
                  aria-current={active ? "true" : undefined}
                  className="hover:underline"
                >
                  {REASON_LABELS[row.reason]}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(row.lastDay)}</td>
              <td className="py-2 text-right tabular-nums">{formatNumber(row.lastWeek)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
