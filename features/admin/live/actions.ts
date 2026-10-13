import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const closeGhostRoomAction = operation<
  Parameters<typeof server.closeGhostRoomAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.closeGhostRoomAction>>["data"]>
>("admin-live-closeGhostRoomAction");
