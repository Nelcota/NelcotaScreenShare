import type { SocialDay } from "@/features/admin/usage/server/queries.server";
import { formatNumber } from "@/lib/format";
import { formatDay, quietLine } from "./UsageTable";

function hasActivity(day: SocialDay): boolean {
  return day.messages > 0 || day.groups > 0 || day.friendRequests > 0;
}

function DaysTable({ days }: { days: SocialDay[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-ink-subtle">
        <tr>
          <th className="py-2 pr-4 font-medium">Dia</th>
          <th className="py-2 pr-4 text-right font-medium">Mensagens</th>
          <th className="py-2 pr-4 text-right font-medium">Grupos novos</th>
          <th className="py-2 text-right font-medium">Pedidos de amizade</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.day} className="border-t border-line">
            <td className="py-2 pr-4 whitespace-nowrap">{formatDay(day.day)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(day.messages)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(day.groups)}</td>
            <td className="py-2 text-right tabular-nums">{formatNumber(day.friendRequests)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Messages, new groups and friend requests per day: only the active days, newest first. */
export function SocialTable({ days }: { days: SocialDay[] }) {
  const active = days.filter(hasActivity);
  const quiet = quietLine(days.length - active.length, days.length);
  return (
    <>
      {active.length > 0 ? <DaysTable days={active} /> : null}
      {quiet ? <p className="text-sm text-ink-muted">{quiet}</p> : null}
    </>
  );
}
