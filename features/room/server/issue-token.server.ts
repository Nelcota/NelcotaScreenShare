import {
  assertDefinitionAdmission,
  definitionByCode,
} from "@/features/rooms/server/room-access.server";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  decideTokenRequest,
  SERVER_ERROR_MESSAGE,
  type TokenAccount,
  type TokenDecision,
  type TokenGuest,
} from "@/features/room/domain/issue-token";
import type { ApprovalRequest, ApprovalResult } from "@/features/room/domain/join-approval";
import type { TokenResponse } from "@/features/room/domain/token-contract";
import { getDb } from "@/server/db/index.server";
import { appUrl, getEnv } from "@/server/env.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { redeemRoomInvite } from "./invites.server";
import { liveKitGateway, type LiveKitGateway } from "./livekit-gateway.server";
import { bannedFromCall } from "./room-bans.server";
import { roomExists } from "./room-codes.server";
import { roomRoleOf } from "./room-roles.server";
import { roomAccessOf } from "./room-access.server";
import { consumeApproval, openJoinRequest, restoreApproval } from "./join-requests.server";
import { recordTokenRequest } from "./token-log.server";
import { AdmissionError, mediaRoomForCode } from "./session-store.server";
import { reserveAdmission } from "./session-admission.server";

// Per account: switching IP does not grant more attempts.
const perAccountLimit = createRateLimiter({ limit: 20, windowMs: 60_000 });
// New requests to enter a room with approval, per IP: a guest gets a new id per cookie.
const newJoinRequests = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });
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

/** Lets in an accepted request once, or opens (or reuses) the pending one. */
async function awaitApproval(
  { room, requester, name, requestId }: ApprovalRequest,
  ipKey: string,
  onUsed: (approvalId: string) => void,
): Promise<ApprovalResult> {
  const db = getDb();
  const used = await consumeApproval(db, { roomCode: room, requester, requestId });
  if (used) {
    onUsed(used);
    return { approved: true };
  }
  const opened = await openJoinRequest(db, {
    roomCode: room,
    requester,
    displayName: name,
    mayOpen: () => newJoinRequests.hit(ipKey).ok,
  });
  if (!opened) return { approved: false, queueFull: true };
  return { approved: false, requestId: opened };
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
  // An approval used on the way in goes back if the person does not get in after all.
  let usedApproval: string | null = null;
  const giveBackApproval = async () => {
    if (usedApproval) await restoreApproval(getDb(), usedApproval);
  };

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
        countParticipants: async (room, identity) =>
          gateway.countParticipants(await mediaRoomForCode(room), identity),
        redeemInvite: (invite, room, accountId) =>
          redeemRoomInvite(getDb(), { token: invite, roomCode: room, userId: accountId }),
        hostPresent: async (room) => gateway.hostPresent(await mediaRoomForCode(room)),
        roomExists: (room) => roomExists(getDb(), room),
        roleOf: (room, accountId) => roomRoleOf(getDb(), { roomCode: room, userId: accountId }),
        bannedFromCall: (room, identity) =>
          bannedFromCall(getDb(), gateway, { roomCode: room, identity }),
        accessOf: (room) => roomAccessOf(getDb(), room),
        awaitApproval: (request) =>
          awaitApproval(request, ipKey, (approvalId) => {
            usedApproval = approvalId;
          }),
      },
    );
    if (!decision.ok) {
      await log(decision.log);
      await giveBackApproval();
      return decision;
    }
    const definition = await definitionByCode(getDb(), decision.grant.room);
    if (definition)
      await assertDefinitionAdmission(getDb(), definition, decision.grant.identity, false);
    if (env.ROOM_HOST_CONTROLS_ENABLED) {
      const admission = await reserveAdmission(getDb(), decision.grant, env.MAX_PARTICIPANTS);
      const token = await gateway.signToken({
        ...decision.grant,
        room: admission.mediaRoomName,
        canShare: admission.canShare,
      });
      await log("granted");
      const publicUrl = new URL("/api/sala/conexao", appUrl());
      publicUrl.protocol = publicUrl.protocol === "https:" ? "wss:" : "ws:";
      return {
        ok: true,
        data: { token, serverUrl: publicUrl.toString(), sessionId: admission.sessionId },
      };
    }
    const token = await gateway.signToken(decision.grant);
    await log("granted");
    return { ok: true, data: { token, serverUrl: env.LIVEKIT_URL } };
  } catch (failure) {
    await giveBackApproval();
    if (failure instanceof AdmissionError) {
      await log(failure.code);
      return { ok: false, error: failure.code, log: failure.code, message: failure.message };
    }
    await log("error");
    return { ok: false, error: "server_error", message: SERVER_ERROR_MESSAGE, failure };
  }
}
