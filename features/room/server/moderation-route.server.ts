import { moderationRequestSchema } from "@/features/room/domain/moderation";
import { readJsonBody, SMALL_JSON_MAX_BYTES } from "@/server/body.server";
import { getDb } from "@/server/db/index.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";
import { liveKitGateway, type LiveKitGateway } from "./livekit-gateway.server";
import { moderateParticipant, type ModerationResult } from "./moderation.server";
import { roomCaller } from "./room-caller.server";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

const STATUS: Record<Extract<ModerationResult, { ok: false }>["error"], number> = {
  forbidden: 403,
  not_in_room: 409,
};

function fail(message: string, status: number) {
  return Response.json({ message }, { status });
}

/** Only accounts moderate: guests are never owners or moderators. */
async function callerAccountId(request: Request): Promise<string | undefined> {
  const caller = await roomCaller(request);
  if (caller?.kind !== "account") return undefined;
  return caller.identity;
}

/** POST /api/sala/moderar: the owner or a moderator kicks or bans someone from the call. */
export async function moderateRoom(request: Request, gateway: LiveKitGateway = liveKitGateway) {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const actorUserId = await callerAccountId(request);
  if (!actorUserId) return fail("Entre na sua conta para moderar a sala.", 401);
  if (!limiter.hit(actorUserId).ok) return fail("Muitas tentativas. Aguarde um pouco.", 429);

  const parsed = moderationRequestSchema.safeParse(
    await readJsonBody(request, SMALL_JSON_MAX_BYTES),
  );
  if (!parsed.success) return fail("Pedido inválido.", 400);

  const log = requestLogger({ route: "api/sala/moderar" });
  try {
    const result = await moderateParticipant(getDb(), gateway, {
      ...parsed.data,
      actorUserId,
    });
    if (!result.ok) return fail(result.message, STATUS[result.error]);
    log.info(
      { room: parsed.data.room, action: parsed.data.action, target: parsed.data.identity },
      "room.moderated",
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    log.error({ err: error }, "failed to moderate the room");
    return fail("Não foi possível agora. Tente de novo.", 502);
  }
}
