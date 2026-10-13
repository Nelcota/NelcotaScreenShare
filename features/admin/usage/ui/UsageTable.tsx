import type { UsageDay } from "@/features/admin/usage/server/queries.server";
import { formatNumber } from "@/lib/format";

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
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-ink-subtle">
        <tr>
          <th className="py-2 pr-4 font-medium">Dia</th>
          <th className="py-2 pr-4 text-right font-medium">Salas</th>
          <th className="py-2 pr-4 text-right font-medium">Pessoas</th>
          <th className="py-2 text-right font-medium">Minutos</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.day} className="border-t border-line">
            <td className="py-2 pr-4 whitespace-nowrap">{formatDay(day.day)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(day.rooms)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(day.people)}</td>
            <td className="py-2 text-right tabular-nums">{formatNumber(day.minutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
