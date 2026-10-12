import { useEffect } from "react";
import { useLoaderData, useLocation, useNavigate } from "react-router";
import {
  HIDDEN_ROOM_PATH,
  rememberedRoomAddress,
} from "@/features/room/client/hidden-room-address";
import { currentStreamerMode } from "@/features/room/hooks/use-streamer-mode";

export const meta = () => [{ title: "Sala · Nelcota" }];

/**
 * `/sala` is what streamer mode leaves in the address bar. On a reload it only exists
 * in this tab: back to the remembered room, or to the home page when there is none.
 */
export function clientLoader() {
  return { address: rememberedRoomAddress() ?? null };
}

export function HydrateFallback() {
  return null;
}

export default function HiddenRoomPage() {
  const { address } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const state: unknown = useLocation().state;
  useEffect(() => {
    // Recover the real route without exposing it or adding another history entry.
    void navigate(address ?? "/", {
      replace: true,
      mask: address && currentStreamerMode() ? HIDDEN_ROOM_PATH : undefined,
      state,
    });
  }, [address, navigate, state]);
  return null;
}
