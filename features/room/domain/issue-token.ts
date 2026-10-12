import { GUEST_IDENTITY_PREFIX } from "./participant-label";
import { tokenRequestSchema, type TokenErrorCode } from "./token-contract";

/**
 * Who may join a room, in the order /api/token checks it. It is plain
 * TypeScript: database, LiveKit and attempt limits come in as functions, and every branch
 * has a test (tests/unit/issue-token.test.ts).
 */

/** Result recorded in token_requests; the database's `token_result` enum is built from it. */
export const TOKEN_LOG_RESULTS = [
  "granted",
  "wrong_password",
  "room_full",
  "rate_limited",
  "blocked",
  "unverified",
  "unauthenticated",
  "invalid",
  "invite_invalid",
  "host_absent",
  "error",
] as const;

export type TokenLogResult = (typeof TOKEN_LOG_RESULTS)[number];

export interface TokenAccount {
  id: string;
  name: string;
  blocked: boolean;
  emailVerified: boolean;
}

/** Someone without an account, known by the signed guest cookie (see guest-session.server). */
export interface TokenGuest {
  guestId: string;
}

export interface TokenPolicy {
  requireVerifiedEmail: boolean;
  /** Room access password (without it, anyone with an account can join). */
  accessPassword: string | undefined;
  maxParticipants: number;
}

interface LimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export interface TokenDeps {
  /** Counts one attempt for the account (switching IP does not grant more attempts). */
  hitAccountLimit: (accountId: string) => LimitResult;
  /** Wrong password: checks, records and resets this IP's failures. */
  passwordFailures: { peek: () => LimitResult; fail: () => void; reset: () => void };
  /** Compares with the access password in constant time. */
  passwordMatches: (given: string) => boolean;
  /** Other identities already inside; replacing one's own connection consumes no new spot. */
  countParticipants: (room: string, excludingIdentity: string) => Promise<number>;
  redeemInvite: (invite: string, room: string, accountId: string) => Promise<boolean>;
  /** Is someone with an account connected? Guests only join a room that has a host. */
  hostPresent: (room: string) => Promise<boolean>;
}

export interface TokenGrant {
  identity: string;
  name: string;
  room: string;
}

/** Refusals the decision can produce (the cross-origin one belongs to the HTTP edge). */
export type TokenRefusal = Exclude<TokenErrorCode, "cross_site">;

export type TokenDecision =
  | { ok: true; grant: TokenGrant; log: "granted" }
  | {
      ok: false;
      error: TokenRefusal;
      log: TokenLogResult;
      message: string;
      retryAfterSeconds?: number;
    };

/** HTTP status of each refusal (the body carries the code and the message). */
export const TOKEN_ERROR_STATUS: Record<TokenRefusal, number> = {
  unauthenticated: 401,
  blocked: 403,
  email_unverified: 403,
  rate_limited: 429,
  invalid_request: 400,
  invalid_password: 401,
  room_full: 409,
  invite_invalid: 403,
  host_absent: 409,
  server_error: 502,
};

export const SERVER_ERROR_MESSAGE =
  "A sala está indisponível no momento. Aguarde alguns segundos e tente de novo.";

function refuse(
  error: TokenRefusal,
  log: TokenLogResult,
  message: string,
  retryAfterSeconds?: number,
): TokenDecision {
  return {
    ok: false,
    error,
    log,
    message,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

function invalidMessage(field: PropertyKey | undefined): string {
  if (field === "password") {
    return "Confira a senha de acesso. Ela deve ter no máximo 128 caracteres.";
  }
  if (field === "room") return "Confira o código da sala ou peça um novo convite a quem enviou.";
  return "Confira os dados de entrada e tente de novo.";
}

/** Account: signed in, active, with a verified email (if required) and within the limit. */
function checkAccount(
  account: TokenAccount | null,
  policy: TokenPolicy,
  deps: TokenDeps,
): TokenDecision | TokenAccount {
  if (!account) {
    return refuse(
      "unauthenticated",
      "unauthenticated",
      "Entre na sua conta para participar da sala.",
    );
  }
  if (account.blocked) {
    return refuse(
      "blocked",
      "blocked",
      "Sua conta não pode entrar em salas. Fale com o suporte se achar que é um engano.",
    );
  }
  if (policy.requireVerifiedEmail && !account.emailVerified) {
    return refuse(
      "email_unverified",
      "unverified",
      "Confirme seu e-mail para entrar em salas. Enviamos um link quando você criou a conta.",
    );
  }
  const limit = deps.hitAccountLimit(account.id);
  if (!limit.ok) {
    return refuse(
      "rate_limited",
      "rate_limited",
      "Muitas tentativas. Aguarde um pouco e tente de novo.",
      limit.retryAfterSeconds,
    );
  }
  return account;
}

/** Access password (when one exists and there is no invite, which replaces it). */
function checkPassword(password: string | undefined, deps: TokenDeps): TokenDecision | undefined {
  const failures = deps.passwordFailures.peek();
  if (!failures.ok) {
    return refuse(
      "rate_limited",
      "rate_limited",
      "Muitas tentativas com a senha errada. Aguarde alguns minutos e tente de novo.",
      failures.retryAfterSeconds,
    );
  }
  if (deps.passwordMatches(password ?? "")) {
    deps.passwordFailures.reset();
    return undefined;
  }
  deps.passwordFailures.fail();
  return refuse(
    "invalid_password",
    "wrong_password",
    "Essa senha não confere. Confira a senha com quem enviou o convite e tente de novo.",
  );
}

type ReadBody = { readable: true; value: unknown } | { readable: false };

function parseRequest(body: ReadBody) {
  if (!body.readable) {
    return refuse(
      "invalid_request",
      "invalid",
      "Não foi possível ler os dados de entrada. Atualize a página e tente de novo.",
    );
  }
  const parsed = tokenRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return refuse("invalid_request", "invalid", invalidMessage(parsed.error.issues[0]?.path[0]));
  }
  return parsed.data;
}

async function checkCapacity(room: string, identity: string, policy: TokenPolicy, deps: TokenDeps) {
  if ((await deps.countParticipants(room, identity)) < policy.maxParticipants) return undefined;
  return refuse(
    "room_full",
    "room_full",
    `A sala está cheia (máximo de ${policy.maxParticipants} pessoas). Aguarde alguém sair e tente de novo.`,
  );
}

/** A guest: a name, the room password (if any), space in the room and a host inside. */
async function decideGuest(
  guest: TokenGuest,
  body: ReadBody,
  policy: TokenPolicy,
  deps: TokenDeps,
): Promise<TokenDecision> {
  const limit = deps.hitAccountLimit(`${GUEST_IDENTITY_PREFIX}${guest.guestId}`);
  if (!limit.ok) {
    return refuse(
      "rate_limited",
      "rate_limited",
      "Muitas tentativas. Aguarde um pouco e tente de novo.",
      limit.retryAfterSeconds,
    );
  }
  const request = parseRequest(body);
  if ("ok" in request) return request;
  const { room, password, invite, guestName } = request;
  if (guestName === undefined) {
    return refuse("invalid_request", "invalid", "Digite seu nome para entrar na sala.");
  }
  // Panel invites count uses per account.
  if (invite !== undefined) {
    return refuse(
      "invite_invalid",
      "invite_invalid",
      "Este convite é para quem tem conta. Entre na sua conta para usá-lo.",
    );
  }
  if (policy.accessPassword) {
    const wrong = checkPassword(password, deps);
    if (wrong) return wrong;
  }
  const identity = `${GUEST_IDENTITY_PREFIX}${guest.guestId}`;
  const full = await checkCapacity(room, identity, policy, deps);
  if (full) return full;
  if (!(await deps.hostPresent(room))) {
    return refuse(
      "host_absent",
      "host_absent",
      "A sala ainda não começou. Espere quem te convidou entrar e tente de novo.",
    );
  }
  return {
    ok: true,
    grant: { identity, name: guestName, room },
    log: "granted",
  };
}

/**
 * Decides whether the caller joins the room: an account, a guest, or nobody. `body` is the
 * request JSON (`readable: false` if it could not be read). Throws only if LiveKit or the
 * database fail (the caller responds "room unavailable").
 */
export async function decideTokenRequest(
  caller: TokenAccount | TokenGuest | null,
  body: ReadBody,
  policy: TokenPolicy,
  deps: TokenDeps,
): Promise<TokenDecision> {
  if (caller !== null && "guestId" in caller) return decideGuest(caller, body, policy, deps);
  const checked = checkAccount(caller, policy, deps);
  if ("ok" in checked) return checked;

  const request = parseRequest(body);
  if ("ok" in request) return request;
  const { room, password, invite } = request;

  // A dashboard invite replaces the access password (it is validated further below).
  if (policy.accessPassword && invite === undefined) {
    const wrong = checkPassword(password, deps);
    if (wrong) return wrong;
  }

  const full = await checkCapacity(room, checked.id, policy, deps);
  if (full) return full;
  // After the capacity check: a full room does not consume an invite use.
  if (invite !== undefined && !(await deps.redeemInvite(invite, room, checked.id))) {
    return refuse(
      "invite_invalid",
      "invite_invalid",
      "Este convite expirou, foi revogado ou já atingiu o limite de pessoas. Peça um novo a quem convidou.",
    );
  }
  return { ok: true, grant: { identity: checked.id, name: checked.name, room }, log: "granted" };
}
