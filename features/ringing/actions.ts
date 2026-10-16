import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const callFriend = operation<
  Parameters<typeof server.callFriend>[0],
  NonNullable<Awaited<ReturnType<typeof server.callFriend>>["data"]>
>("ringing-callFriend");
export const cancelCall = operation<
  Parameters<typeof server.cancelCall>[0],
  NonNullable<Awaited<ReturnType<typeof server.cancelCall>>["data"]>
>("ringing-cancelCall");
export const declineCall = operation<
  Parameters<typeof server.declineCall>[0],
  NonNullable<Awaited<ReturnType<typeof server.declineCall>>["data"]>
>("ringing-declineCall");
export const acceptCall = operation<
  Parameters<typeof server.acceptCall>[0],
  NonNullable<Awaited<ReturnType<typeof server.acceptCall>>["data"]>
>("ringing-acceptCall");
export const callGroup = operation<
  Parameters<typeof server.callGroup>[0],
  NonNullable<Awaited<ReturnType<typeof server.callGroup>>["data"]>
>("ringing-callGroup");
