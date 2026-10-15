import { Link } from "react-router";
import { StatusBadge } from "@/components/StatusBadge";
import type { LiveRoom } from "@/features/admin/live/server/queries.server";
import { ROOM_ACCESS_LABEL } from "@/features/room/domain/room-access";
import { formatDateTime, formatRelative } from "@/lib/format";
import { CloseGhostButton } from "./CloseGhostButton";

function PersonName({ person }: { person: LiveRoom["people"][number] }) {
  if (!person.userId) return <>{person.name}</>;
  return (
    <Link viewTransition to={`/admin/usuarios/${person.userId}`} className="hover:underline">
      {person.name}
    </Link>
  );
}

/** "Dono: Ana · Com aprovação", only for rooms created with "Criar sala". */
function RoomStaffLine({ staff }: { staff: LiveRoom["staff"] }) {
  if (!staff) return null;
  const parts = [staff.owner ? `Dono: ${staff.owner}` : null, ROOM_ACCESS_LABEL[staff.access]];
  return <p className="text-sm text-ink-muted">{parts.filter(Boolean).join(" · ")}</p>;
}

function People({ people }: { people: LiveRoom["people"] }) {
  if (people.length === 0) return <p className="text-sm text-ink-muted">Ninguém na sala.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {people.map((person) => (
        <li key={person.id} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            <PersonName person={person} />
          </span>
          <span
            className="shrink-0 text-ink-muted"
            title={`Entrou em ${formatDateTime(person.joinedAt)}`}
          >
            entrou {formatRelative(person.joinedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One live room: code, since when, who is in it and whether someone shares (yes/no only). */
export function LiveRoomCard({
  room,
  ghost,
  canClose,
}: {
  room: LiveRoom;
  ghost: boolean;
  canClose: boolean;
}) {
  return (
    <li className="panel flex flex-col gap-3 rounded-2xl p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            viewTransition
            to={`/admin/salas/${room.id}`}
            className="font-sans text-base font-semibold tabular-nums hover:underline"
          >
            {room.code}
          </Link>
          <p className="text-sm text-ink-muted" title={formatDateTime(room.startedAt)}>
            Aberta {formatRelative(room.startedAt)}
          </p>
          <RoomStaffLine staff={room.staff} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ghost ? <StatusBadge tone="warning">Fora do LiveKit</StatusBadge> : null}
          {room.sharing ? <StatusBadge tone="live">Tela compartilhada</StatusBadge> : null}
        </div>
      </header>
      <People people={room.people} />
      {ghost && canClose ? (
        <div>
          <CloseGhostButton id={room.id} code={room.code} />
        </div>
      ) : null}
    </li>
  );
}
