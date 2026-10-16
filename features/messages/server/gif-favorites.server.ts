import { and, count, desc, eq } from "drizzle-orm";
import { MAX_GIF_FAVORITES } from "@/features/messages/domain/conversation";
import type { DbExecutor } from "@/server/db/index.server";
import { gifFavorites } from "@/server/db/schema";

/** Saves a favourite; false when the list is already full. Saving it twice changes nothing. */
export async function addGifFavorite(db: DbExecutor, userId: string, slug: string) {
  const [row] = await db
    .select({ total: count() })
    .from(gifFavorites)
    .where(eq(gifFavorites.userId, userId));
  if ((row?.total ?? 0) >= MAX_GIF_FAVORITES) return false;
  await db.insert(gifFavorites).values({ userId, slug }).onConflictDoNothing();
  return true;
}

export async function removeGifFavorite(db: DbExecutor, userId: string, slug: string) {
  await db
    .delete(gifFavorites)
    .where(and(eq(gifFavorites.userId, userId), eq(gifFavorites.slug, slug)));
}

/** Newest first, as the Favoritos tab shows them. */
export async function gifFavoriteSlugs(db: DbExecutor, userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: gifFavorites.slug })
    .from(gifFavorites)
    .where(eq(gifFavorites.userId, userId))
    .orderBy(desc(gifFavorites.createdAt));
  return rows.map((row) => row.slug);
}
