import { requestControlState } from "@/features/room/server/control-state.server";
import type { Route } from "./+types/controls";

export function loader({ request }: Route.LoaderArgs) {
  return requestControlState(request);
}
