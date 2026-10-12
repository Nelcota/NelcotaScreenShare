import { operation } from "@/lib/operations/operation";
import type * as server from "./actions.server";
export const teamWorkspaceAction = operation<
  Parameters<typeof server.teamWorkspaceAction>[0],
  NonNullable<Awaited<ReturnType<typeof server.teamWorkspaceAction>>["data"]>
>("team-teamWorkspaceAction");
