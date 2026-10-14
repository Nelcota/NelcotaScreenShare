import type { UsageDay } from "@/features/admin/usage/server/queries.server";
import { formatNumber } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

/** "2026-10-11" (already a São Paulo day) → "sáb., 11/10". */
export function formatDay(day: string): string {
  return dayLabel.format(new Date(`${day}T12:00:00Z`));
}

function hasUsage(day: UsageDay): boolean {
  return day.rooms > 0 || day.people > 0 || day.minutes > 0;
}

export function quietLine(quietDays: number, total: number): string | null {
  if (quietDays === 0) return null;
  if (quietDays === total) return `Sem uso nos últimos ${total} dias.`;
  if (quietDays === 1) return "Sem uso em 1 dia.";
  return `Sem uso nos outros ${quietDays} dias.`;
}

function DaysTable({ days }: { days: UsageDay[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dia</TableHead>
          <TableHead className="text-right">Salas</TableHead>
          <TableHead className="text-right">Pessoas</TableHead>
          <TableHead className="text-right">Minutos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {days.map((day) => (
          <TableRow key={day.day}>
            <TableCell>{formatDay(day.day)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(day.rooms)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(day.people)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(day.minutes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Only the days with calls, newest first, and one line for the quiet ones. */
export function UsageTable({ days }: { days: UsageDay[] }) {
  const busy = days.filter(hasUsage);
  const quiet = quietLine(days.length - busy.length, days.length);
  return (
    <>
      {busy.length > 0 ? <DaysTable days={busy} /> : null}
      {quiet ? <p className="text-sm text-ink-muted">{quiet}</p> : null}
    </>
  );
}
