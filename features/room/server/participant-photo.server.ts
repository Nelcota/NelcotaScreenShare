import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { users } from "@/server/db/schema";

const WEBP_DATA_URL_PREFIX = "data:image/webp;base64,";

/** The stored photo (a WebP data URL validated on save) as bytes, or null when there is none. */
export function photoBytesFromDataUrl(dataUrl: string | null): Uint8Array<ArrayBuffer> | null {
  if (!dataUrl?.startsWith(WEBP_DATA_URL_PREFIX)) return null;
  const bytes = Buffer.from(dataUrl.slice(WEBP_DATA_URL_PREFIX.length), "base64");
  if (bytes.length === 0) return null;
  return new Uint8Array(bytes);
}

/** Profile photo of an active account; blocked, anonymized or deleted accounts show none. */
export async function profilePhotoOf(
  db: DbExecutor,
  userId: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const [row] = await db
    .select({ image: users.image })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        isNull(users.blockedAt),
        isNull(users.anonymizedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  return photoBytesFromDataUrl(row.image);
}

/** Long enough to avoid refetching while the layout reflows, short enough to see a new photo. */
const PHOTO_CACHE = "private, max-age=300";
/** "This person has no photo" is cached briefly too, so lists do not ask again on every render. */
const NO_PHOTO_CACHE = "private, max-age=60";

export function noPhotoResponse(cache: "short" | "none" = "none"): Response {
  const cacheControl = cache === "short" ? NO_PHOTO_CACHE : "no-store";
  return Response.json(
    { message: "Sem foto." },
    { status: 404, headers: { "Cache-Control": cacheControl } },
  );
}

/** The photo as a WebP response with a validator, or 304 when the browser already has it. */
export function photoResponse(request: Request, photo: Uint8Array<ArrayBuffer> | null): Response {
  if (!photo) return noPhotoResponse("short");
  const etag = `"${createHash("sha256").update(photo).digest("base64url").slice(0, 22)}"`;
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
