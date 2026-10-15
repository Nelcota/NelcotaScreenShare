import { GUEST_IDENTITY_PREFIX } from "./participant-label";
import { checkApproval, type ApprovalRequest, type ApprovalResult } from "./join-approval";
import { GUEST_WAIT_TEXT } from "./join";
import type { RoomAccess } from "./room-access";
import type { RoomRole } from "./room-role";
import { tokenRequestSchema, type TokenErrorCode } from "./token-contract";

/**
 * Who may join a room, in the order /api/token checks it. It is plain
 * TypeScript: database, LiveKit and attempt limits come in as functions, and every branch
 * has a test (tests/unit/issue-token.test.ts).
 */

/**
 * Result recorded in token_requests; the database's `token_result` enum is built from it, in
 * the same order: each migration adds the new value before "error".
 */
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
  "room_locked",
  "room_removed",
  "room_closed",
  "room_not_found",
  "banned",
  "awaiting_approval",
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
  /** Was the room created? Any other code is refused. */
  roomExists: (room: string) => Promise<boolean>;
  /** The account's saved role in the room. */
  roleOf: (room: string, accountId: string) => Promise<RoomRole>;
  /** Was this identity banned from the call happening now in the room? */
  bannedFromCall: (room: string, identity: string) => Promise<boolean>;
  /** Open entry or entry with approval. */
  accessOf: (room: string) => Promise<RoomAccess>;
  /**
   * Was some guest banned from the call happening now? A guest without the cookie comes
   * back as a new one, so from then on new guests ask first, even in an open room.
   */
  guestBannedFromCall: (room: string) => Promise<boolean>;
  /** Lets in an accepted request once, or opens the request and returns its id to follow. */
  awaitApproval: (request: ApprovalRequest) => Promise<ApprovalResult>;
}

export interface TokenGrant {
  identity: string;
  name: string;
  room: string;
  /** Saved room role; grants built by the host controls carry none (plain participant). */
  role?: RoomRole;
  canShare?: boolean;
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
      requestId?: string;
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

function granted(grant: TokenGrant): TokenDecision {
  return { ok: true, grant, log: "granted" };
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
      "Sua conta não pode entrar em salas. Se for um engano, fale com o suporte.",
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
    "Senha incorreta. Confira com quem enviou o convite.",
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

/** Only rooms created through "Criar sala" exist. */
async function checkRoomExists(room: string, deps: TokenDeps) {
  if (await deps.roomExists(room)) return undefined;
  return refuse("room_not_found", "room_not_found", "Esta sala não existe. Confira o link.");
}

async function checkCapacity(room: string, identity: string, policy: TokenPolicy, deps: TokenDeps) {
  if ((await deps.countParticipants(room, identity)) < policy.maxParticipants) return undefined;
  return refuse(
    "room_full",
    "room_full",
    `A sala está cheia (máximo de ${policy.maxParticipants} pessoas). Aguarde alguém sair e tente de novo.`,
  );
}

/** Banned from this call: refused before the password, so a ban cannot be guessed past. */
async function checkBan(room: string, identity: string, deps: TokenDeps) {
  if (!(await deps.bannedFromCall(room, identity))) return undefined;
  return refuse(
    "banned",
    "banned",
    "Tiraram você desta chamada. Você pode voltar quando ela terminar.",
  );
}

/** A guest: a name, the room password (if any), space in the room and a host inside. */
async function decideGuest(
  guest: TokenGuest,
  body: ReadBody,
  policy: TokenPolicy,
  deps: TokenDeps,
): Promise<TokenDecision> {
  const identity = `${GUEST_IDENTITY_PREFIX}${guest.guestId}`;
  const limit = deps.hitAccountLimit(identity);
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
  const { room, password, invite, guestName, requestId } = request;
  const missing = await checkRoomExists(room, deps);
  if (missing) return missing;
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
  const banned = await checkBan(room, identity, deps);
  if (banned) return banned;
  if (policy.accessPassword) {
    const wrong = checkPassword(password, deps);
    if (wrong) return wrong;
  }
  const full = await checkCapacity(room, identity, policy, deps);
  if (full) return full;
  if (!(await deps.hostPresent(room))) {
    return refuse("host_absent", "host_absent", GUEST_WAIT_TEXT);
  }
  const waiting = await checkApproval(
    { room, requester: { guestId: guest.guestId }, name: guestName, requestId },
    "participant",
    deps,
  );
  if (waiting) return waiting;
  // Guests have no saved identity, so they are never owners or moderators.
  return granted({ identity, name: guestName, room, role: "participant" });
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
  const { room, password, invite, requestId } = request;
  const missing = await checkRoomExists(room, deps);
  if (missing) return missing;

  const banned = await checkBan(room, checked.id, deps);
  if (banned) return banned;

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
  const role = await deps.roleOf(room, checked.id);
  const waiting = await checkApproval(
    { room, requester: { userId: checked.id }, name: checked.name, requestId },
    role,
    deps,
  );
  if (waiting) return waiting;
  return granted({ identity: checked.id, name: checked.name, room, role });
}
