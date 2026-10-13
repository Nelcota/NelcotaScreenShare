import { ConnectionError, ConnectionErrorReason, DisconnectReason } from "livekit-client";
import type { LeaveReason } from "@/features/room/domain/leave";

/** Failure to open the connection to the room. */
export function connectErrorMessage(error: unknown): string {
  if (error instanceof ConnectionError) {
    // LiveKit has no dedicated reason for a full room: only the message says so.
    // Happens when two people pass the /api/token check at the same time.
    if (/full/i.test(error.message)) {
      return "A sala está cheia. Aguarde alguém sair e tente de novo.";
    }
    switch (error.reason) {
      case ConnectionErrorReason.NotAllowed:
        return "Não foi possível autorizar sua entrada. Toque em Tentar de novo para renovar o acesso.";
      case ConnectionErrorReason.ServerUnreachable:
      case ConnectionErrorReason.WebSocket:
        return "Não foi possível conectar à sala. Verifique sua internet e tente de novo.";
      case ConnectionErrorReason.Timeout:
        return "A conexão demorou demais. Tente de novo ou use outra rede.";
      default:
        break;
    }
  }
  return "Não foi possível conectar à sala. Aguarde alguns segundos e tente de novo.";
}

/** Drop of an already open connection (`undefined`: no specific message). */
export function disconnectMessage(reason: DisconnectReason | undefined): string | undefined {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "Você entrou nesta sala em outra aba ou dispositivo.";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "Quem cuida da sala tirou você da chamada.";
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return "A sala foi encerrada. Volte ao início para criar uma nova sala.";
    case DisconnectReason.SERVER_SHUTDOWN:
      return "A sala ficou indisponível. Entre de novo em alguns segundos.";
    case DisconnectReason.JOIN_FAILURE:
    case DisconnectReason.SIGNAL_CLOSE:
    case DisconnectReason.CONNECTION_TIMEOUT:
      return "A conexão caiu. Verifique sua internet e toque em Voltar para a sala.";
    default:
      return undefined;
  }
}

/** Drop of an already open connection, as the reason the leave screen understands. */
export function disconnectReason(reason: DisconnectReason | undefined): LeaveReason {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "elsewhere";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "removed";
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return "ended";
    default:
      return "dropped";
  }
}
