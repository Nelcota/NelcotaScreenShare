import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const createRoomAction = operation<
  Parameters<typeof server.createRoomAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.createRoomAction>>["data"]>
>("room-createRoomAction");
export const roomAccess = operation<
  Parameters<typeof server.roomAccess>[0],
  NonNullable<Awaited<ReturnType<typeof server.roomAccess>>["data"]>
>("room-roomAccess", "get");
export const setRoomAccess = operation<
  Parameters<typeof server.setRoomAccess>[0],
  NonNullable<Awaited<ReturnType<typeof server.setRoomAccess>>["data"]>
>("room-setRoomAccess");
export const joinRequests = operation<
  Parameters<typeof server.joinRequests>[0],
  NonNullable<Awaited<ReturnType<typeof server.joinRequests>>["data"]>
>("room-joinRequests", "get");
export const answerJoin = operation<
  Parameters<typeof server.answerJoin>[0],
  NonNullable<Awaited<ReturnType<typeof server.answerJoin>>["data"]>
>("room-answerJoin");

export const hostCommandAction = operation<
  Parameters<typeof server.hostCommandAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.hostCommandAction>>["data"]>
>("room-hostCommandAction");
