import { useEffect } from "react";
import { useBlocker } from "react-router";
import { roomCodeFromPath, shouldConfirmRoomSwitch } from "@/features/room/domain/room-switch";

/** A navigation to another room, held until the person decides. */
export interface PendingRoomSwitch {
  from: string;
  /** Undefined only if the blocked path stops being a room path (not expected). */
  to: string | undefined;
  confirm: () => void;
  cancel: () => void;
}

/**
 * Holds any navigation from a call in `activeCode` to another room. Confirming drops the
 * call first (`leaveCall`) and then goes on; cancelling stays where the person is.
 * Other pages and the same room are never held, so the call goes on minimized there.
 */
export function useRoomSwitchGuard(
  activeCode: string | undefined,
  leaveCall: () => void,
): PendingRoomSwitch | undefined {
  const blocker = useBlocker(({ nextLocation }) =>
    shouldConfirmRoomSwitch(activeCode, nextLocation.pathname),
  );
  const stale = blocker.state === "blocked" && activeCode === undefined;

  // The call ended while the question was open (e.g. another tab took over): nothing to
  // drop any more, so the navigation the person asked for goes on.
  useEffect(() => {
    if (stale) blocker.proceed?.();
  }, [stale, blocker]);

  if (blocker.state !== "blocked") return undefined;
  if (activeCode === undefined) return undefined;

  return {
    from: activeCode,
    to: roomCodeFromPath(blocker.location.pathname),
    confirm: () => {
      leaveCall();
      blocker.proceed();
    },
    cancel: () => blocker.reset(),
  };
}
