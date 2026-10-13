import type { TokenLogResult } from "./issue-token";
import type { SAVED_ROOM_ROLES } from "./room-role";

/** How each entry attempt reads in "Baixar meus dados". */
export const TOKEN_RESULT_IN_EXPORT: Record<TokenLogResult, string> = {
  granted: "aceito",
  wrong_password: "senha errada",
  room_full: "sala cheia",
  rate_limited: "muitas tentativas",
  blocked: "conta bloqueada",
  unverified: "e-mail não confirmado",
  unauthenticated: "sem sessão",
  invalid: "pedido inválido",
  invite_invalid: "convite inválido",
  host_absent: "sem anfitrião na sala",
  room_locked: "sala trancada",
  room_removed: "removido da chamada",
  room_closed: "sala encerrada",
  room_not_found: "sala inexistente",
  banned: "banido da chamada",
  awaiting_approval: "esperando aprovação",
  error: "erro",
};

/** How a saved role reads in "Baixar meus dados". */
export const ROOM_ROLE_IN_EXPORT: Record<(typeof SAVED_ROOM_ROLES)[number], string> = {
  owner: "dono",
  moderator: "moderador",
};
