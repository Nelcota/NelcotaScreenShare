import { z } from "zod";
import { roomCodeSchema } from "@/features/room/domain/room-code";
import { identitiesIn } from "@/features/room/server/livekit-gateway.server";
import {
  noPhotoResponse,
  photoResponse,
  profilePhotoOf,
} from "@/features/room/server/participant-photo.server";
import { roomCaller } from "@/features/room/server/room-caller.server";
import { getDb } from "@/server/db/index.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";
import { mediaRoomForCode } from "./session-store.server";

const photoQuerySchema = z.object({ sala: roomCodeSchema, pessoa: z.uuid() });
/** A call shows at most a few dozen avatars; this only stops scraping. */
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

function fail(message: string, status: number) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Both people are connected to the same call right now (one's own photo always is). */
async function sharesCall(callerIdentity: string, personId: string, room: string) {
  if (callerIdentity === personId) return true;
  const identities = new Set(await identitiesIn(await mediaRoomForCode(room)));
  return identities.has(callerIdentity) && identities.has(personId);
}

/**
 * Profile photo of someone in the same call. The token carries no image (a data URL is too
 * large for it), so the browser asks for each one. Only someone connected to the room sees
 * the photos of the others in it; otherwise, the same 404 as "no photo" so the route does not
 * tell who is in which room.
 */
export async function participantPhoto(request: Request) {
  const caller = await roomCaller(request);
  if (!caller) return fail("Entre na sala de novo para continuar.", 401);
  if (!limiter.hit(caller.identity).ok) return fail("Muitos pedidos. Aguarde um pouco.", 429);

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = photoQuerySchema.safeParse(query);
  if (!parsed.success) return fail("Pedido inválido.", 400);
  const { sala, pessoa } = parsed.data;

  try {
    if (!(await sharesCall(caller.identity, pessoa, sala))) return noPhotoResponse();
  } catch (error) {
    requestLogger({ route: "api/sala/foto" }).error({ err: error }, "failed to list room");
    return fail("Não foi possível agora. Tente de novo.", 502);
  }

  return photoResponse(request, await profilePhotoOf(getDb(), pessoa));
}
