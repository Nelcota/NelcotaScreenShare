import { Link } from "react-router";
import { Facts, Section } from "@/components/Section";
import { ACCESS_LABELS, LEAVE_REASON_LABELS } from "@/features/admin/rooms/domain/labels";
import { RemoveParticipant } from "@/features/admin/rooms/ui/RemoveParticipant";
import type { getRoomDetail } from "@/features/admin/rooms/server/queries.server";
import type { RemovedBy, RemovedPerson } from "@/features/admin/rooms/server/room-removals.server";
import type { RoomStaff } from "@/features/admin/rooms/server/room-staff.server";
import { ReadmitButton } from "@/features/admin/rooms/ui/ReadmitButton";
import { formatDateTime, formatRelative, formatSpan } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RoomDetail = NonNullable<Awaited<ReturnType<typeof getRoomDetail>>>;

/** Room summary: times, duration, peak, who created it. */
export function RoomSummary({
  room,
  online,
  shareCount,
}: {
  room: RoomDetail["room"];
  /** People in the room right now (only while the room is live). */
  online: number | null;
  shareCount: number;
}) {
  return (
    <Section title="Resumo">
      <Facts
        items={[
          ["Início", formatDateTime(room.startedAt)],
          ["Fim", room.finishedAt ? formatDateTime(room.finishedAt) : "—"],
          ["Duração", formatSpan(room.startedAt, room.finishedAt)],
          ["Pico de pessoas", String(room.peak)],
          ...(online === null
            ? []
            : ([["Na sala agora", String(online)]] satisfies [string, string][])),
          ["Compartilhamentos", String(shareCount)],
          [
            "Criada por",
            room.createdById ? (
              <Link
                viewTransition
                key="criador"
                to={`/admin/usuarios/${room.createdById}`}
                className="hover:underline"
              >
                {room.createdByName ?? "Participante"}
              </Link>
            ) : (
              "—"
            ),
          ],
          ...(room.deletedAt
            ? ([["Excluída em", formatDateTime(room.deletedAt)]] satisfies [string, string][])
            : []),
        ]}
      />
    </Section>
  );
}

function StaffLink({ member }: { member: { id: string; name: string } }) {
  return (
    <Link viewTransition to={`/admin/usuarios/${member.id}`} className="hover:underline">
      {member.name}
    </Link>
  );
}

function Moderators({ moderators }: { moderators: RoomStaff["moderators"] }) {
  if (moderators.length === 0) return "—";
  return moderators.map((member, index) => (
    <span key={member.id}>
      {index > 0 ? ", " : null}
      <StaffLink member={member} />
    </span>
  ));
}

/** Owner, moderators and how people get in, for rooms created with "Criar sala". */
export function RoomStaffSection({ staff }: { staff: RoomStaff }) {
  return (
    <Section title="Dono e moderadores">
      <Facts
        items={[
          ["Dono", staff.owner ? <StaffLink key="dono" member={staff.owner} /> : "—"],
          ["Moderadores", <Moderators key="moderadores" moderators={staff.moderators} />],
          ["Entrada", ACCESS_LABELS[staff.access]],
        ]}
      />
    </Section>
  );
}

function removedByLabel(removedBy: RemovedBy): string {
  if (!removedBy) return "";
  if (removedBy.kind === "panel") return " pelo painel";
  return ` por ${removedBy.name}`;
}

/**
 * Who was banned from the call happening now; with `canReadmit`, each one can be let back.
 * `null` removals: LiveKit did not answer.
 */
export function RoomRemovals({
  roomId,
  removals,
  canReadmit,
}: {
  roomId: string;
  removals: RemovedPerson[] | null;
  canReadmit: boolean;
}) {
  if (removals === null) {
    return (
      <Section title="Removidos desta chamada" description="O LiveKit não respondeu agora.">
        {null}
      </Section>
    );
  }
  if (removals.length === 0) return null;
  return (
    <Section title="Removidos desta chamada" description="Não voltam até a chamada acabar.">
      <ul className="flex flex-col divide-y divide-line text-sm">
        {removals.map((person) => (
          <li
            key={person.identity}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <span>
              <span className="font-medium">
                {person.userId ? (
                  <Link
                    viewTransition
                    to={`/admin/usuarios/${person.userId}`}
                    className="hover:underline"
                  >
                    {person.name}
                  </Link>
                ) : (
                  person.name
                )}
              </span>
              <span className="text-ink-muted" title={formatDateTime(person.removedAt)}>
                {" "}
                ·{removedByLabel(person.removedBy)} {formatRelative(person.removedAt)}
              </span>
            </span>
            {canReadmit ? (
              <ReadmitButton roomId={roomId} identity={person.identity} name={person.name} />
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Who joined, when, and why they left; with `canRemove`, those still in the call can be removed. */
export function RoomParticipants({
  participants,
  canRemove,
}: {
  participants: RoomDetail["participants"];
  canRemove: boolean;
}) {
  return (
    <Section
      title="Participantes"
      description={participants.length === 0 ? "Ninguém entrou nesta sala." : undefined}
    >
      {participants.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Entrou</TableHead>
                <TableHead>Saiu</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Saída</TableHead>
                {canRemove ? (
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell className="whitespace-normal">
                    {participant.userId ? (
                      <Link
                        viewTransition
                        to={`/admin/usuarios/${participant.userId}`}
                        className="hover:underline"
                      >
                        {participant.name}
                      </Link>
                    ) : (
                      participant.name
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(participant.joinedAt)}</TableCell>
                  <TableCell>
                    {participant.leftAt ? formatDateTime(participant.leftAt) : "—"}
                  </TableCell>
                  <TableCell>{formatSpan(participant.joinedAt, participant.leftAt)}</TableCell>
                  <TableCell className="whitespace-normal text-ink-muted">
                    {participant.leaveReason
                      ? (LEAVE_REASON_LABELS[participant.leaveReason] ?? "—")
                      : "Na sala"}
                  </TableCell>
                  {canRemove ? (
                    <TableCell className="pl-4 whitespace-normal">
                      {participant.leftAt === null ? (
                        <RemoveParticipant
                          participationId={participant.id}
                          name={participant.name}
                          guest={participant.userId === null}
                        />
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Section>
  );
}

/** The room's screen shares, with duration and audio. */
export function RoomShares({ shares }: { shares: RoomDetail["shares"] }) {
  return (
    <Section
      title="Compartilhamentos de tela"
      description={shares.length === 0 ? "Ninguém compartilhou a tela." : undefined}
    >
      {shares.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {shares.map((share) => (
            <li key={share.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium">
                {share.name}
                {share.withAudio ? <span className="text-ink-muted"> · com áudio</span> : null}
              </span>
              <span className="text-ink-muted">
                {formatDateTime(share.startedAt)} · {formatSpan(share.startedAt, share.endedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
