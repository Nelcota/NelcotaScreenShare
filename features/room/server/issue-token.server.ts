import { createHash, timingSafeEqual } from "node:crypto";
import {
  decideTokenRequest,
  SERVER_ERROR_MESSAGE,
  type TokenAccount,
  type TokenDecision,
  type TokenGuest,
} from "@/features/room/domain/issue-token";
import type { TokenResponse } from "@/features/room/domain/token-contract";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { redeemRoomInvite } from "./invites.server";
import { liveKitGateway, type LiveKitGateway } from "./livekit-gateway.server";
import { recordTokenRequest } from "./token-log.server";

// Per account: switching IP does not grant more attempts.
const perAccountLimit = createRateLimiter({ limit: 20, windowMs: 60_000 });
// Wrong password: few chances per IP, with a long window, against brute force.
const passwordFailures = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

/** Compares in constant time (the hash equalizes lengths before timingSafeEqual). */
function safeEqual(given: string, expected: string): boolean {
  const hashA = createHash("sha256").update(given).digest();
  const hashB = createHash("sha256").update(expected).digest();
  return timingSafeEqual(hashA, hashB);
}

export type IssueTokenResult =
  | { ok: true; data: TokenResponse }
  | Extract<TokenDecision, { ok: false }>
  | { ok: false; error: "server_error"; message: string; failure: unknown };

interface IssueTokenInput {
  /** The signed-in account, a guest (no account) or nobody. */
  caller: TokenAccount | TokenGuest | null;
  body: { readable: true; value: unknown } | { readable: false };
  /** Client IP (null if unknown; the password limit uses "desconhecido"). */
  ip: string | null;
  /** Requested room, for the record only (the request may still be invalid). */
  requestedRoom: string;
}

/**
 * Issues the LiveKit token: decides (domain/issue-token), records the result
 * in token_requests and signs. A LiveKit or database failure becomes "room unavailable".
 */
export async function issueRoomToken(
  { caller, body, ip, requestedRoom }: IssueTokenInput,
  gateway: LiveKitGateway = liveKitGateway,
): Promise<IssueTokenResult> {
  const env = getEnv();
  const ipKey = ip ?? "desconhecido";
  const userId = caller !== null && "id" in caller ? caller.id : null;
  const log = (result: TokenDecision["log"] | "error") =>
    recordTokenRequest({ roomCode: requestedRoom, userId, result, ip });

  try {
    const decision = await decideTokenRequest(
      caller,
      body,
      {
        requireVerifiedEmail: env.REQUIRE_EMAIL_VERIFICATION,
        accessPassword: env.ACCESS_PASSWORD,
        maxParticipants: env.MAX_PARTICIPANTS,
      },
      {
        hitAccountLimit: (id) => perAccountLimit.hit(id),
        passwordFailures: {
          peek: () => passwordFailures.peek(ipKey),
          fail: () => void passwordFailures.hit(ipKey),
          reset: () => passwordFailures.reset(ipKey),
        },
        passwordMatches: (given) => safeEqual(given, env.ACCESS_PASSWORD ?? ""),
        countParticipants: (room, identity) => gateway.countParticipants(room, identity),
        redeemInvite: (invite, room, accountId) =>
          redeemRoomInvite(getDb(), { token: invite, roomCode: room, userId: accountId }),
        hostPresent: (room) => gateway.hostPresent(room),
      },
    );
    await log(decision.log);
    if (!decision.ok) return decision;
    const token = await gateway.signToken(decision.grant);
    return { ok: true, data: { token, serverUrl: env.LIVEKIT_URL } };
  } catch (failure) {
    await log("error");
    return { ok: false, error: "server_error", message: SERVER_ERROR_MESSAGE, failure };
  }
}
