import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { GIF_SLUG_PATTERN, MAX_GIF_FAVORITES } from "@/features/messages/domain/conversation";
import {
  addGifFavorite,
  gifFavoriteSlugs,
  removeGifFavorite,
} from "@/features/messages/server/gif-favorites.server";
import { getDb } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";

const slugSchema = z.object({ slug: z.string().regex(GIF_SLUG_PATTERN) });

/** Favourites keep only the slug; the GIF itself is fetched again when shown. */
export const favoriteGif = defineUserOperation(
  { name: "messages.gif_favorite", audit: "none" },
  slugSchema,
  async ({ parsedInput, ctx }) => {
    const saved = await addGifFavorite(getDb(), ctx.current.user.id, parsedInput.slug);
    if (!saved) throw new ActionError(`Limite de ${MAX_GIF_FAVORITES} favoritos atingido.`);
    return { favorite: true };
  },
);

export const unfavoriteGif = defineUserOperation(
  { name: "messages.gif_unfavorite", audit: "none" },
  slugSchema,
  async ({ parsedInput, ctx }) => {
    await removeGifFavorite(getDb(), ctx.current.user.id, parsedInput.slug);
    return { favorite: false };
  },
);

export const listGifFavorites = defineUserOperation(
  { name: "messages.gif_favorites", audit: "none" },
  z.object({}),
  async ({ ctx }) => ({ slugs: await gifFavoriteSlugs(getDb(), ctx.current.user.id) }),
);
