/**
 * pt-BR messages for Better Auth errors. Sign-in and recovery always use
 * the same sentence for a nonexistent e-mail and a wrong password (they do not
 * reveal who has an account).
 */
/** Any operation called without a session answers this (operation-policies.server). */
export const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre de novo.";

const BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar. Enviamos um novo link agora.",
  USER_ALREADY_EXISTS: "Confira seu e-mail para continuar.",
  // Only with e-mail confirmation turned off (with it, the response is generic).
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com esse e-mail. Entre com sua senha ou recupere a senha.",
  FAILED_TO_CREATE_SESSION: "E-mail ou senha incorretos.",
  INVALID_PASSWORD: "Senha incorreta.",
  INVALID_CODE: "Código inválido ou expirado. Confira o app autenticador e tente de novo.",
  INVALID_TWO_FACTOR_COOKIE: "A verificação expirou. Entre com e-mail e senha de novo.",
  INVALID_BACKUP_CODE: "Código de backup inválido ou já usado.",
  ACCOUNT_TEMPORARILY_LOCKED: "Muitas tentativas de código. Aguarde alguns minutos.",
  INVALID_TOKEN: "Este link não vale mais. Peça um novo.",
  PASSWORD_TOO_SHORT: "A senha é curta demais.",
  PASSWORD_TOO_LONG: "A senha é longa demais.",
  SESSION_EXPIRED: SESSION_EXPIRED_MESSAGE,
  SESSION_NOT_FRESH: "Por segurança, saia da sua conta e entre de novo para trocar o e-mail.",
  CROSS_SITE_REQUEST: "Requisição recusada. Atualize a página e tente de novo.",
  ADMIN_DISABLED: "O painel admin está desligado neste servidor.",
};

/**
 * Codes whose message the server already writes in pt-BR: the sign-in lockout
 * (with the wait time) and the disabled admin account.
 */
const SERVER_WORDED = new Set(["SIGN_IN_LOCKED", "BANNED_USER"]);

const GENERIC_MESSAGE = "Algo deu errado. Tente de novo.";

export interface AuthErrorLike {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
}

export function authErrorMessage(
  error: AuthErrorLike | null | undefined,
  fallback = GENERIC_MESSAGE,
): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  const known = BY_CODE[code];
  if (known) return known;
  if (SERVER_WORDED.has(code) && error.message) return error.message;
  // The per-IP rate limit answers 429 with an English message.
  if (error.status === 429) return "Muitas tentativas. Aguarde um minuto.";
  return fallback;
}
