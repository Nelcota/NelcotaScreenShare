import type { SocialDay } from "@/features/admin/usage/server/queries.server";
import { formatNumber } from "@/lib/format";
import { formatDay, quietLine } from "./UsageTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function hasActivity(day: SocialDay): boolean {
  return day.messages > 0 || day.groups > 0 || day.friendRequests > 0;
}

function DaysTable({ days }: { days: SocialDay[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dia</TableHead>
          <TableHead className="text-right">Mensagens</TableHead>
          <TableHead className="text-right">Grupos novos</TableHead>
          <TableHead className="text-right">Pedidos de amizade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {days.map((day) => (
          <TableRow key={day.day}>
            <TableCell>{formatDay(day.day)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(day.messages)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(day.groups)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(day.friendRequests)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
