import type { LeaveNotice } from "@/features/room/domain/leave";
import { roomControlStateSchema } from "@/features/room/domain/host-controls";

/** The relay can close before LiveKit delivers its reason; consult committed authority. */
export async function controlledDisconnectNotice(
  code: string,
  sessionId: string | undefined,
  fallback: LeaveNotice,
): Promise<LeaveNotice> {
  if (!sessionId) return fallback;
  try {
    const response = await fetch(
      `/api/sala/controles?${new URLSearchParams({ room: code, sessionId })}`,
      { signal: AbortSignal.timeout(1_500) },
    );
    if (!response.ok) return fallback;
    const parsed = roomControlStateSchema.safeParse(await response.json());
    if (!parsed.success) return fallback;
    if (parsed.data.removed)
      return { reason: "removed", message: "Você foi removido desta chamada." };
    if (parsed.data.closed)
      return {
        reason: "ended",
        message: parsed.data.permanent
          ? "A chamada foi encerrada. O link continua disponível."
          : "A sala foi encerrada pelo anfitrião. Crie outra sala para continuar.",
      };
    return fallback;
  } catch {
    return fallback;
  }
}
