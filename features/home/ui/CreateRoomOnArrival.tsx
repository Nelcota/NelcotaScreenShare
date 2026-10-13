import { useEffect, useRef } from "react";
import { useCreateRoom } from "@/features/home/hooks/use-create-room";

/**
 * Back from sign-up or sign-in after "Criar sala": creates the room once, without a second
 * click. The room replaces this address, so going back does not create another one.
 */
export function CreateRoomOnArrival() {
  const { createRoom } = useCreateRoom({ replace: true });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createRoom();
  }, [createRoom]);
  return null;
}
