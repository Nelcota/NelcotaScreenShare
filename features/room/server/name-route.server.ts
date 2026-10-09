import { ServerError } from "livekit-server-sdk";
import { z } from "zod";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { roomCodeSchema } from "@/features/room/domain/room-code";
import { roomCaller } from "@/features/room/server/room-caller.server";
import { roomService } from "@/features/room/server/room-service.server";
import { getUserAuth } from "@/features/auth/server/participant-auth.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";

const nameSchema = z.object({ room: roomCodeSchema, name: displayNameSchema });
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function fail(message: string, status: number) {
  return Response.json({ message }, { status });
}

/**
 * Changes one's own name during a call, for everyone in the room at once. The server
 * writes it (the token lacks canUpdateOwnMetadata, which would let anyone rename
 * themselves without checks) and only on the caller's own identity. An account also keeps
 * the new name for the next rooms; a guest's lives in the call and in their browser.
 */
export async function setRoomName(request: Request) {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const caller = await roomCaller(request);
  if (!caller) return fail("Entre na sala de novo para continuar.", 401);
  if (!limiter.hit(caller.identity).ok) {
    return fail("Muitas trocas seguidas. Aguarde um pouco e tente de novo.", 429);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = nameSchema.safeParse(body);
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
    return fail(nameIssue?.message ?? "Pedido inválido.", 400);
  }
  const { room, name } = parsed.data;
  const log = requestLogger({ route: "api/sala/nome" });

  // The room first: it also proves the caller is in this call before the account changes.
  try {
    await roomService().updateParticipant(room, caller.identity, { name });
  } catch (error) {
    if (error instanceof ServerError && error.status === 404) {
      return fail("Você não está nesta sala.", 409);
    }
    log.error({ err: error }, "failed to rename participant");
    return fail("Não foi possível trocar o nome agora. Tente de novo.", 502);
  }

  if (caller.kind === "guest") return Response.json({ name });
  try {
    await getUserAuth().api.updateUser({ body: { name }, headers: request.headers });
  } catch (error) {
    log.error({ err: error }, "failed to save account name");
    return fail("O nome mudou nesta sala, mas não foi salvo na sua conta. Tente de novo.", 502);
  }
  return Response.json({ name });
}
