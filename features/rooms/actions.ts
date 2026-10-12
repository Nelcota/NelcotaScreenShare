import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const roomWorkspaceAction = operation<
  Parameters<typeof server.roomWorkspaceAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.roomWorkspaceAction>>["data"]>
>("rooms-roomWorkspaceAction");
