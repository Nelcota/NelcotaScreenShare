import {
  assertDefinitionAdmission,
  lockDefinitionPro,
} from "@/features/rooms/server/room-access.server";
import { TokenVerifier } from "livekit-server-sdk";
import { and, eq, sql } from "drizzle-orm";
import { getDb, type Database } from "@/server/db/index.server";
import { appUrl, getEnv } from "@/server/env.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { getClientIp } from "@/server/client-ip.server";
import { roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { mayShareScreen } from "@/features/room/domain/host-controls";
import {
  AdmissionError,
  activeAccount,
  assertAdmission,
  lockControlRoom,
  memberInSession,
  sessionByMediaName,
} from "./session-store.server";
import { liveKitGateway } from "./livekit-gateway.server";
import { roomRoleOf } from "./room-roles.server";
import { controlGateway } from "./control-gateway.server";
import { reconcileSessionPresence } from "./session-presence.server";
import { SignalRelay } from "./signal-relay.server";

const attempts = createRateLimiter({ limit: 60, windowMs: 60_000 });

/** Recheck even server-refreshed credentials: the JWT conveys identity, never authority. */
export async function authorizeSignal(
  db: Database,
  token: string,
  connect?: (url: URL, room: string, identity: string) => Promise<SignalRelay>,
) {
  const env = getEnv();
  const claims = await new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)
    .verify(token)
    .catch(() => {
      throw new AdmissionError("room_removed", "Credencial inválida ou expirada.");
    });
  if (!claims.sub || !claims.video?.room || !claims.video.roomJoin)
    throw new AdmissionError("room_removed", "Credencial inválida.");
  const identity = claims.sub;
  const initial = await sessionByMediaName(db, claims.video.room);
  if (!initial) throw new AdmissionError("room_closed", "Esta chamada não está disponível.");
  return db.transaction(async (tx) => {
    await lockDefinitionPro(tx, initial.definition);
    await lockControlRoom(tx, initial.code);
    const resolved = await sessionByMediaName(tx, initial.session.mediaRoomName);
    if (!resolved) throw new AdmissionError("room_closed", "Esta chamada não está disponível.");
    await assertDefinitionAdmission(tx, resolved.definition, identity, !resolved.session.startedAt);
    const participants = await controlGateway.participants(resolved.session.mediaRoomName);
    const session = await reconcileSessionPresence(tx, resolved.session, participants, new Date());
    const member = await memberInSession(tx, session.id, identity);
    assertAdmission(session, member, Boolean(resolved.definitionClosed));
    if (!member || expiredReservation(member))
      throw new AdmissionError("room_removed", "Solicite uma nova entrada nesta chamada.");
    const account = await activeAccount(tx, identity);
    if (!isGuestIdentity(identity) && !account)
      throw new AdmissionError("room_removed", "Sua conta não pode entrar em salas.");
    if (
      participants.filter((person) => person.identity !== identity).length >= env.MAX_PARTICIPANTS
    )
      throw new AdmissionError("room_full", "A sala está cheia.");
    // The saved role, not the one in the old token: it may have changed since.
    const role = account
      ? await roomRoleOf(tx, { roomCode: resolved.code, userId: identity })
      : "participant";
    const freshToken = await liveKitGateway.signToken({
      room: session.mediaRoomName,
      identity,
      name: account?.name ?? claims.name ?? "Convidado",
      role,
      canShare: mayShareScreen(
        identity,
        session.hostUserId,
        session.sharePolicy,
        session.allowedSharers,
      ),
    });
    const url = new URL(env.LIVEKIT_URL);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/rtc`;
    url.searchParams.set("access_token", freshToken);
    // Protocol 16 uses binary signaling and supports current participant permissions.
    url.searchParams.set("protocol", "16");
    url.searchParams.set("auto_subscribe", "1");
    const relay = await connect?.(url, session.mediaRoomName, identity);
    if (relay) {
      await tx
        .update(roomSessions)
        .set({
          status: "active",
          startedAt: session.startedAt ?? new Date(),
          participantCount: sql`${roomSessions.participantCount} + ${Number(!member.admittedAt)}`,
        })
        .where(eq(roomSessions.id, session.id));
      await tx
        .update(roomSessionMembers)
        .set({ admittedAt: member.admittedAt ?? new Date() })
        .where(
          and(
            eq(roomSessionMembers.sessionId, session.id),
            eq(roomSessionMembers.identity, identity),
          ),
        );
    }
    return relay;
  });
}

export async function openSignal(request: Request): Promise<SignalRelay | Response> {
  const refusal = checkSignalRequest(request);
  if (refusal) return refusal;
  const token = new URL(request.url).searchParams.get("access_token");
  if (!token || token.length > 32_768) return new Response(null, { status: 401 });
  try {
    const relay = await authorizeSignal(getDb(), token, async (url, room, identity) => {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname.endsWith("/rtc/v1")) {
        url.pathname += "/v1";
        const join = requestUrl.searchParams.get("join_request");
        if (!join || join.length > 32_768)
          throw new AdmissionError("room_removed", "Pedido de conexão inválido.");
        url.searchParams.set("join_request", join);
      }
      const supplied = new URL(request.url).searchParams;
      for (const key of [
        "protocol",
        "sdk",
        "version",
        "reconnect",
        "sid",
        "auto_subscribe",
        "adaptive_stream",
        "subscriber_primary",
      ]) {
        const value = supplied.get(key);
        if (value !== null && value.length <= 128) url.searchParams.set(key, value);
      }
      const opened = new SignalRelay(room, identity, url);
      try {
        await opened.ready();
        return opened;
      } catch (error) {
        opened.close();
        throw error;
      }
    });
    return relay ?? new Response(null, { status: 503 });
  } catch (error) {
    if (error instanceof AdmissionError)
      return Response.json({ message: error.message }, { status: 403 });
    // Never echo/log a signaling URL: its query contains a bearer credential.
    return new Response(null, { status: 503 });
  }
}

export async function validateSignal(request: Request) {
  const refusal = checkSignalRequest(request);
  if (refusal) return refusal;
  const token = new URL(request.url).searchParams.get("access_token");
  if (!token || token.length > 32_768) return new Response(null, { status: 401 });
  try {
    await authorizeSignal(getDb(), token);
    return new Response("OK", { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { message: error instanceof AdmissionError ? error.message : "Conexão indisponível." },
      { status: 403 },
    );
  }
}

function checkSignalRequest(request: Request) {
  const env = getEnv();
  if (!env.ROOM_HOST_CONTROLS_ENABLED) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(appUrl()).origin) return new Response(null, { status: 403 });
  if (!attempts.hit(getClientIp(request.headers, env.TRUSTED_PROXY_HOPS)).ok)
    return new Response(null, { status: 429 });
  return undefined;
}

function expiredReservation(member: { admittedAt: Date | null; reservedUntil: Date }) {
  return !member.admittedAt && member.reservedUntil.getTime() < Date.now();
}
