import { createHash } from "node:crypto";
import { z } from "zod";
import { roomCodeSchema } from "@/features/room/domain/room-code";
import { identitiesIn } from "@/features/room/server/livekit-gateway.server";
import { profilePhotoOf } from "@/features/room/server/participant-photo.server";
import { roomCaller } from "@/features/room/server/room-caller.server";
import { getDb } from "@/server/db/index.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";
import { mediaRoomForCode } from "./session-store.server";

const photoQuerySchema = z.object({ sala: roomCodeSchema, pessoa: z.uuid() });
/** A call shows at most a few dozen avatars; this only stops scraping. */
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

/** Long enough to avoid refetching while the layout reflows, short enough to see a new photo. */
const PHOTO_CACHE = "private, max-age=300";
/** "This person has no photo" is cached briefly too, so each tile does not ask LiveKit again. */
const NO_PHOTO_CACHE = "private, max-age=60";

function fail(message: string, status: number, cache = "no-store") {
  return Response.json({ message }, { status, headers: { "Cache-Control": cache } });
}

function etagOf(bytes: Uint8Array<ArrayBuffer>): string {
  return `"${createHash("sha256").update(bytes).digest("base64url").slice(0, 22)}"`;
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
    if (!(await sharesCall(caller.identity, pessoa, sala))) return fail("Sem foto.", 404);
  } catch (error) {
    requestLogger({ route: "api/sala/foto" }).error({ err: error }, "failed to list room");
    return fail("Não foi possível agora. Tente de novo.", 502);
  }

  const photo = await profilePhotoOf(getDb(), pessoa);
  if (!photo) return fail("Sem foto.", 404, NO_PHOTO_CACHE);

  const etag = etagOf(photo);
  const headers = {
    "Cache-Control": PHOTO_CACHE,
    ETag: etag,
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(photo, { status: 200, headers });
}
