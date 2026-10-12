import { z } from "zod";
import { getDb } from "@/server/db/index.server";
import { notFound } from "@/server/http.server";
import { ActionError } from "@/server/operations/action-error";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { accessibleDefinition } from "./room-access.server";
import { sessionHistory } from "./queries.server";

export async function workspaceUser(path: string) {
  const current = await requireUser(path, { requireVerified: false });
  const { name, image } = current.user;
  return { actor: current.user.id, account: { name, image } };
}
export function workspaceId(value: string | undefined) {
  const result = z.uuid().safeParse(value);
  if (!result.success) notFound();
  return result.data;
}
export async function loadRoomHistory(
  actor: string,
  roomId: string,
  cursor?: string,
  teamId?: string,
) {
  try {
    const room = await accessibleDefinition(getDb(), roomId, actor);
    if ((teamId ?? null) !== room.teamId) notFound();
    return {
      room: { name: room.name, code: room.code, teamId: room.teamId },
      history: await sessionHistory(getDb(), actor, roomId, cursor),
    };
  } catch (error) {
    if (error instanceof ActionError) notFound();
    throw error;
  }
}
