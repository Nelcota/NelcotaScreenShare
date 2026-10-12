import { ServerError } from "livekit-server-sdk";
import { z } from "zod";
import { roomCodeSchema } from "@/features/room/domain/room-code";
import { HAND_ATTRIBUTE } from "@/features/room/domain/data-channel";
import { roomCaller } from "@/features/room/server/room-caller.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { roomService } from "@/features/room/server/room-service.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";
import { readJsonBody, SMALL_JSON_MAX_BYTES } from "@/server/body.server";
import { mediaRoomForCode } from "./session-store.server";

const handSchema = z.object({ room: roomCodeSchema, raised: z.boolean() });
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

function fail(message: string, status: number) {
  return Response.json({ message }, { status });
}

/**
 * Raising or lowering the hand. The attribute is written by the server, not by the
 * browser: the token lacks canUpdateOwnMetadata, which would also allow
 * changing one's own name in the room. The identity is always the caller's own.
 */
export async function setRaisedHand(request: Request) {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const identity = (await roomCaller(request))?.identity;
  if (!identity) return fail("Entre na sala de novo para continuar.", 401);
  if (!limiter.hit(identity).ok) return fail("Muitas tentativas. Aguarde um pouco.", 429);

  const parsed = handSchema.safeParse(await readJsonBody(request, SMALL_JSON_MAX_BYTES));
  if (!parsed.success) return fail("Pedido inválido.", 400);
  const { room, raised } = parsed.data;

  try {
    await roomService().updateParticipant(await mediaRoomForCode(room), identity, {
      attributes: { [HAND_ATTRIBUTE]: raised ? "1" : "" },
    });
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return fail("Você não está nesta sala.", 409);
    }
    requestLogger({ route: "api/sala/mao" }).error({ err: error }, "failed to raise hand");
    return fail("Não foi possível agora. Tente de novo.", 502);
  }
  return new Response(null, { status: 204 });
}
