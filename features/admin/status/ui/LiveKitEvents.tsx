import { Link } from "react-router";
import { Facts, Section } from "@/components/Section";
import { eventLabel } from "@/features/admin/status/domain/event-labels";
import type { LiveKitEventsSummary } from "@/features/admin/status/server/livekit-events.server";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function RoomLink({ code }: { code: string | null }) {
  if (!code) return <>—</>;
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

function LastEvent({ lastEvent }: { lastEvent: LiveKitEventsSummary["lastEvent"] }) {
  if (!lastEvent) return <>Nenhum evento recebido ainda.</>;
  return (
    <span title={formatDateTime(lastEvent.receivedAt)}>
      {eventLabel(lastEvent.event)} · {formatRelative(lastEvent.receivedAt)}
    </span>
  );
}

type Failures = LiveKitEventsSummary["recentFailures"];

/** Phone width: one stacked item per event instead of a table that scrolls sideways. */
function FailuresList({ failures }: { failures: Failures }) {
  return (
    <ul className="flex flex-col divide-y divide-line text-sm sm:hidden">
      {failures.map((failure) => (
        <li key={failure.id} className="flex flex-col gap-0.5 py-2">
          <span className="font-medium">{eventLabel(failure.event)}</span>
          <span className="text-ink-muted">
            {formatDateTime(failure.receivedAt)} · <RoomLink code={failure.roomName} />
          </span>
          <span className="text-ink-muted">{failure.error}</span>
        </li>
      ))}
    </ul>
  );
}

function FailuresTable({ failures }: { failures: Failures }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Sala</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failures.map((failure) => (
            <TableRow key={failure.id}>
              <TableCell>{formatDateTime(failure.receivedAt)}</TableCell>
              <TableCell>{eventLabel(failure.event)}</TableCell>
              <TableCell className="whitespace-normal">
                <RoomLink code={failure.roomName} />
              </TableCell>
              <TableCell className="whitespace-normal text-ink-muted">{failure.error}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** What the LiveKit webhook delivered last and which events could not be applied. */
export function LiveKitEvents({ summary }: { summary: LiveKitEventsSummary }) {
  const shown = summary.recentFailures.length;
  const more = summary.failedCount - shown;
  return (
    <Section title="Eventos do LiveKit">
      <Facts
        items={[
          ["Último evento", <LastEvent key="ultimo" lastEvent={summary.lastEvent} />],
          ["Com erro", formatNumber(summary.failedCount)],
        ]}
      />
      {shown > 0 ? (
        <>
          <FailuresList failures={summary.recentFailures} />
          <FailuresTable failures={summary.recentFailures} />
          <p className="text-sm text-ink-muted">
            {more > 0 ? `Os ${shown} mais recentes. ` : ""}Nova tentativa automática a cada 6 horas.
          </p>
        </>
      ) : null}
    </Section>
  );
}
