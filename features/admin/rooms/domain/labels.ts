import type { BadgeTone } from "@/components/StatusBadge";
import type { RoomAccess } from "@/features/room/domain/room-access";
import { ROOM_STATUSES, type RoomStatus } from "./search-params";

/** `filter`: the plural shown in the status filter. */
export const STATUS_LABELS: Record<RoomStatus, { label: string; filter: string; tone: BadgeTone }> =
  {
    ativa: { label: "Ao vivo", filter: "Ao vivo", tone: "live" },
    encerrada: { label: "Encerrada", filter: "Encerradas", tone: "neutral" },
    excluida: { label: "Excluída", filter: "Excluídas", tone: "neutral" },
  };

export const STATUS_OPTIONS = ROOM_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value].filter,
}));

/** A deleted room shows as deleted whatever its LiveKit status. */
export function roomStatus(room: { status: "active" | "finished"; deleted: boolean }): RoomStatus {
  if (room.deleted) return "excluida";
  if (room.status === "active") return "ativa";
  return "encerrada";
}

/** How people get into a room created with "Criar sala". */
export const ACCESS_LABELS: Record<RoomAccess, string> = {
  open: "Livre",
  approval: "Com aprovação",
};

/** Leave reason of a participation. */
export const LEAVE_REASON_LABELS: Record<string, string> = {
  left: "Saiu",
  disconnected: "Caiu a conexão",
  removed_by_admin: "Removido da chamada",
  room_closed: "Sala encerrada",
  unknown: "Desconhecido",
};
