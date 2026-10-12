import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { getUserAuth } from "@/features/auth/server/participant-auth.server";
import {
  TOKEN_ERROR_STATUS,
  type TokenAccount,
  type TokenGuest,
  type TokenRefusal,
} from "@/features/room/domain/issue-token";
import { issueRoomToken } from "@/features/room/server/issue-token.server";
import { newGuestSession, readGuestId } from "@/features/room/server/guest-session.server";
import { clientIpFrom } from "@/server/client-ip.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";
import { sessionWithCookies } from "@/server/response-cookies.server";
import { readJsonBody, SMALL_JSON_MAX_BYTES } from "@/server/body.server";

// Per-IP excess does not reach the database: a flood does not become a flood of writes.
const perIpLimit = createRateLimiter({ limit: 20, windowMs: 60_000 });

function rejection(
  error: TokenRefusal,
  message: string,
  retryAfterSeconds?: number,
  headers: Record<string, string> = {},
) {
  return Response.json(
    { error, message },
    {
      status: TOKEN_ERROR_STATUS[error],
      headers: {
        ...headers,
        ...(retryAfterSeconds === undefined ? {} : { "Retry-After": String(retryAfterSeconds) }),
      },
    },
  );
}

/** Without a session the caller is a guest: the signed cookie's id, or a new one. */
async function guestCaller(
  request: Request,
): Promise<{ caller: TokenGuest; headers: Record<string, string> }> {
  const known = await readGuestId(request);
  if (known) return { caller: { guestId: known }, headers: {} };
  const created = await newGuestSession(request);
  return { caller: { guestId: created.guestId }, headers: { "Set-Cookie": created.setCookie } };
}

/** Body read before the checks, only to record the requested room in every result. */
async function readBody(request: Request) {
  const value = await readJsonBody(request, SMALL_JSON_MAX_BYTES);
  if (value === null) return { body: { readable: false as const }, room: "" };
  const room =
    typeof value === "object" && "room" in value && typeof value.room === "string"
      ? value.room.trim().toLowerCase()
      : "";
  return { body: { readable: true as const, value }, room };
}

/**
 * LiveKit token for joining a room. Only the HTTP edge lives here (origin,
 * IP, body, session); who may join is decided in features/room.
 */
export async function requestRoomToken(request: Request) {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const ip = clientIpFrom(request.headers) ?? null;
  const limit = perIpLimit.hit(ip ?? "desconhecido");
  if (!limit.ok) {
    return rejection(
      "rate_limited",
      "Muitas tentativas. Aguarde um pouco e tente de novo.",
      limit.retryAfterSeconds,
    );
  }

  const { body, room } = await readBody(request);
  const session = await sessionWithCookies(
    getUserAuth().api.getSession({ headers: request.headers, returnHeaders: true }),
  );
  const {
    caller,
    headers,
  }: { caller: TokenAccount | TokenGuest; headers: Record<string, string> } = session
    ? {
        caller: {
          id: session.user.id,
          name: session.user.name,
          blocked: Boolean(session.user.blockedAt || session.user.deletedAt),
          emailVerified: session.user.emailVerified,
        },
        headers: {},
      }
    : await guestCaller(request);

  const result = await issueRoomToken({ caller, body, ip, requestedRoom: room });
  if (result.ok) {
    return Response.json(result.data, { headers: { ...headers, "Cache-Control": "no-store" } });
  }
  if ("failure" in result) {
    const log = requestLogger({ route: "api/token" });
    log.error({ err: result.failure }, "failed to generate token");
  }
  return rejection(
    result.error,
    result.message,
    "retryAfterSeconds" in result ? result.retryAfterSeconds : undefined,
    headers,
  );
}
