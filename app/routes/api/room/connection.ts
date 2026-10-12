import { validateSignal } from "@/features/room/server/signal-admission.server";
import type { Route } from "./+types/connection";

/** Upgrades are handled by Hono; the explicit resource route preserves SSR routing. */
export function loader({ request }: Route.LoaderArgs) {
  if (new URL(request.url).pathname.endsWith("/rtc/validate")) return validateSignal(request);
  return new Response(null, { status: 426 });
}
