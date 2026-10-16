import { z } from "zod";
import { relationTo } from "@/features/friends/server/friend-list.server";
import { photoResponse, profilePhotoOf } from "@/features/room/server/participant-photo.server";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { getDb } from "@/server/db/index.server";
import { createRateLimiter } from "@/server/rate-limit.server";

const photoQuerySchema = z.object({ pessoa: z.uuid() });
/** The friends page shows up to a few hundred avatars; this only stops scraping. */
const limiter = createRateLimiter({ limit: 600, windowMs: 60_000 });

/**
 * Relations that show the photo: friends, and a request received. Not a request sent: anyone
 * can ask a stranger, and that must not reveal their photo.
 */
const SHOWS_PHOTO = new Set(["self", "friends", "received"]);

/** Seen again within a minute: a photo added now shows up soon after. */
const NO_PHOTO_CACHE = "private, max-age=60";

/**
 * No photo, or not allowed to see it: 204, the same for both. An empty answer is no error,
 * so the lists' initials stay without a 404 in the console for every friend without a photo.
 * Not allowed is never cached, so a friendship accepted now shows the photo at once.
 */
function noPhoto(cache: "short" | "none"): Response {
  const cacheControl = cache === "short" ? NO_PHOTO_CACHE : "no-store";
  return new Response(null, { status: 204, headers: { "Cache-Control": cacheControl } });
}

/**
 * Profile photo for the friends lists. Only a friend, or someone who received a request from
 * that person, sees it; anyone else gets the same empty answer as "no photo".
 */
export async function friendPhoto(request: Request) {
  const current = await getUserSession();
  if (!current) return Response.json({ message: "Entre de novo para continuar." }, { status: 401 });
  if (!limiter.hit(current.user.id).ok) {
    return Response.json({ message: "Muitos pedidos. Aguarde um pouco." }, { status: 429 });
  }
  const parsed = photoQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Pedido inválido." }, { status: 400 });

  const db = getDb();
  const relation = await relationTo(db, current.user.id, parsed.data.pessoa);
  if (!SHOWS_PHOTO.has(relation)) return noPhoto("none");
  const photo = await profilePhotoOf(db, parsed.data.pessoa);
  if (!photo) return noPhoto("short");
  return photoResponse(request, photo);
}
