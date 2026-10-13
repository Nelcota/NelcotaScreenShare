import { TOKEN_LOG_RESULTS, type TokenLogResult } from "@/features/room/domain/issue-token";

/** Refused at the door by the token, or refused by the owner when the room asks for approval. */
export type TokenDenialReason = Exclude<TokenLogResult, "granted">;
export type DenialReason = TokenDenialReason | "join_declined";

const TOKEN_DENIAL_REASONS = TOKEN_LOG_RESULTS.filter(
  (result): result is TokenDenialReason => result !== "granted",
);
const DENIAL_REASONS: readonly DenialReason[] = [...TOKEN_DENIAL_REASONS, "join_declined"];

export const REASON_LABELS: Record<DenialReason, string> = {
  wrong_password: "Senha de acesso errada",
  room_full: "Sala cheia",
  rate_limited: "Muitas tentativas",
  blocked: "Conta bloqueada",
  unverified: "E-mail não confirmado",
  unauthenticated: "Sem entrar na conta",
  invalid: "Pedido inválido",
  invite_invalid: "Convite inválido ou vencido",
  host_absent: "Sala sem anfitrião",
  banned: "Banido da chamada",
  room_not_found: "Sala que não existe",
  awaiting_approval: "Esperando aprovação",
  room_locked: "Sala trancada",
  room_removed: "Tirado da chamada",
  room_closed: "Chamada encerrada",
  error: "Erro no servidor",
  join_declined: "Pedido recusado",
};

export function isDenialReason(value: unknown): value is DenialReason {
  return typeof value === "string" && (DENIAL_REASONS as readonly string[]).includes(value);
}

export function isTokenDenialReason(value: unknown): value is TokenDenialReason {
  return typeof value === "string" && (TOKEN_DENIAL_REASONS as readonly string[]).includes(value);
}
