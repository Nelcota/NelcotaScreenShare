import { z } from "zod";
import { GUEST_IDENTITY_PREFIX } from "@/features/room/domain/participant-label";
import { roomCaller } from "@/features/room/server/room-caller.server";
import { joinRequestStatus, type JoinRequester } from "@/features/room/server/join-requests.server";
import { getDb } from "@/server/db/index.server";
import { createRateLimiter } from "@/server/rate-limit.server";

const statusQuerySchema = z.object({ id: z.uuid() });
/** The waiting screen asks every couple of seconds for two minutes. */
const limiter = createRateLimiter({ limit: 90, windowMs: 60_000 });

function fail(message: string, status: number) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

function requesterOf(caller: { kind: "account" | "guest"; identity: string }): JoinRequester {
  if (caller.kind === "account") return { userId: caller.identity };
  return { guestId: caller.identity.slice(GUEST_IDENTITY_PREFIX.length) };
}

/** Where my request to enter stands: pending, accepted, declined or expired. */
export async function joinRequestState(request: Request) {
  const caller = await roomCaller(request);
  if (!caller) return fail("Entre na sala de novo para continuar.", 401);
  if (!limiter.hit(caller.identity).ok) return fail("Muitos pedidos. Aguarde um pouco.", 429);
  const parsed = statusQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail("Pedido inválido.", 400);

  const status = await joinRequestStatus(getDb(), {
    requestId: parsed.data.id,
    requester: requesterOf(caller),
  });
  if (!status) return fail("Pedido não encontrado.", 404);
  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
