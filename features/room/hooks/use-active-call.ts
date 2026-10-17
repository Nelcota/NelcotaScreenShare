import { useSyncExternalStore } from "react";

/**
 * The room of the call going on in this tab, published by `ActiveRoom` (in the root) for
 * pages outside the room, such as the start's "Voltar à chamada". Undefined with no call.
 */
let activeCallCode: string | undefined;
const listeners = new Set<() => void>();

export function setActiveCallCode(code: string | undefined) {
  if (code === activeCallCode) return;
  activeCallCode = code;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active call's room code; undefined on the server and with no call. */
export function useActiveCallCode(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => activeCallCode,
    () => undefined,
  );
}
