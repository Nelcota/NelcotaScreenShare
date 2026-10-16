import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
import type * as codes from "./code-actions.server";
import type * as statuses from "./status-actions.server";
export const sendFriendRequest = operation<
  Parameters<typeof server.sendFriendRequest>[0],
  NonNullable<Awaited<ReturnType<typeof server.sendFriendRequest>>["data"]>
>("friends-sendFriendRequest");
export const answerFriendRequest = operation<
  Parameters<typeof server.answerFriendRequest>[0],
  NonNullable<Awaited<ReturnType<typeof server.answerFriendRequest>>["data"]>
>("friends-answerFriendRequest");
export const cancelFriendRequest = operation<
  Parameters<typeof server.cancelFriendRequest>[0],
  NonNullable<Awaited<ReturnType<typeof server.cancelFriendRequest>>["data"]>
>("friends-cancelFriendRequest");
export const removeFriend = operation<
  Parameters<typeof server.removeFriend>[0],
  NonNullable<Awaited<ReturnType<typeof server.removeFriend>>["data"]>
>("friends-removeFriend");
export const blockUser = operation<
  Parameters<typeof server.blockUser>[0],
  NonNullable<Awaited<ReturnType<typeof server.blockUser>>["data"]>
>("friends-blockUser");
export const unblockUser = operation<
  Parameters<typeof server.unblockUser>[0],
  NonNullable<Awaited<ReturnType<typeof server.unblockUser>>["data"]>
>("friends-unblockUser");
export const friendRelation = operation<
  Parameters<typeof server.friendRelation>[0],
  NonNullable<Awaited<ReturnType<typeof server.friendRelation>>["data"]>
>("friends-friendRelation", "get");
export const addFriend = operation<
  Parameters<typeof codes.addFriend>[0],
  NonNullable<Awaited<ReturnType<typeof codes.addFriend>>["data"]>
>("friends-addFriend");
export const newFriendCode = operation<
  Parameters<typeof codes.newFriendCode>[0],
  NonNullable<Awaited<ReturnType<typeof codes.newFriendCode>>["data"]>
>("friends-newFriendCode");
export const setPresenceStatus = operation<
  Parameters<typeof statuses.setPresenceStatus>[0],
  NonNullable<Awaited<ReturnType<typeof statuses.setPresenceStatus>>["data"]>
>("friends-setPresenceStatus");
