import { useEffect } from "react";
import { isLeavingPageAllowed } from "@/lib/leave-warning";

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  if (isLeavingPageAllowed()) return;
  event.preventDefault();
}

/**
 * During a call, reloading, typing another address or closing the tab asks first: a full page
 * load ends the call. Moving inside the app never fires it, and leaving the call removes it.
 */
export function useLeaveCallWarning(inCall: boolean): void {
  useEffect(() => {
    if (!inCall) return;
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [inCall]);
}
