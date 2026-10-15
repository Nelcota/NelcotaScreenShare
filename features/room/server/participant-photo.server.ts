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
