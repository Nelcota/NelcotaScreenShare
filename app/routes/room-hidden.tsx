import { redirect } from "react-router";
import { rememberedRoomAddress } from "@/features/room/client/hidden-room-address";

export const meta = () => [{ title: "Sala · Nelcota" }];

/**
 * `/sala` is what streamer mode leaves in the address bar. On a reload it only exists
 * in this tab: back to the remembered room, or to the home page when there is none.
 */
export function clientLoader() {
  return redirect(rememberedRoomAddress() ?? "/");
}

export function HydrateFallback() {
  return null;
}

export default function HiddenRoomPage() {
  return null;
}
