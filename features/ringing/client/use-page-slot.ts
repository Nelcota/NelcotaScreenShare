import { useSyncExternalStore } from "react";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import { pageSlot, subscribePageSlots } from "@/lib/page-slot";

/**
 * An empty element another feature leaves on its page (by id, with `pageSlotRef`) for this one
 * to fill through a portal; followed as that page mounts and unmounts it. Null while inactive
 * or absent.
 */
export function usePageSlot(id: string, active = true) {
  return useSyncExternalStore(
    active ? subscribePageSlots : subscribeNothing,
    () => (active ? pageSlot(id) : null),
    () => null,
  );
}
