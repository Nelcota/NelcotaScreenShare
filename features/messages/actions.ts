import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
import type * as gifs from "./gif-actions.server";
export const openDirectConversation = operation<
  Parameters<typeof server.openDirectConversation>[0],
  NonNullable<Awaited<ReturnType<typeof server.openDirectConversation>>["data"]>
>("messages-openDirectConversation");
export const createGroupConversation = operation<
  Parameters<typeof server.createGroupConversation>[0],
  NonNullable<Awaited<ReturnType<typeof server.createGroupConversation>>["data"]>
>("messages-createGroupConversation");
export const sendMessage = operation<
  Parameters<typeof server.sendMessage>[0],
  NonNullable<Awaited<ReturnType<typeof server.sendMessage>>["data"]>
>("messages-sendMessage");
export const deleteMessage = operation<
  Parameters<typeof server.deleteMessage>[0],
  NonNullable<Awaited<ReturnType<typeof server.deleteMessage>>["data"]>
>("messages-deleteMessage");
export const markConversationRead = operation<
  Parameters<typeof server.markConversationRead>[0],
  NonNullable<Awaited<ReturnType<typeof server.markConversationRead>>["data"]>
>("messages-markConversationRead");
export const leaveGroup = operation<
  Parameters<typeof server.leaveGroup>[0],
  NonNullable<Awaited<ReturnType<typeof server.leaveGroup>>["data"]>
>("messages-leaveGroup");
export const favoriteGif = operation<
  Parameters<typeof gifs.favoriteGif>[0],
  NonNullable<Awaited<ReturnType<typeof gifs.favoriteGif>>["data"]>
>("messages-favoriteGif");
export const unfavoriteGif = operation<
  Parameters<typeof gifs.unfavoriteGif>[0],
  NonNullable<Awaited<ReturnType<typeof gifs.unfavoriteGif>>["data"]>
>("messages-unfavoriteGif");
export const listMessages = operation<
  Parameters<typeof server.listMessages>[0],
  NonNullable<Awaited<ReturnType<typeof server.listMessages>>["data"]>
>("messages-listMessages", "get");
