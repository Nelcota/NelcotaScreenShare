import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  firstOtherTabCall,
  NO_OTHER_TAB_CALLS,
  openCallTabs,
  type CallTabs,
  type OtherTabCalls,
} from "@/features/room/client/call-tabs";

/**
 * Tells the other tabs this one is in a call in `code` while mounted (and until the tab
 * closes). `onLeaveRequested`: another tab joined a call and this one must leave.
 */
export function useAnnounceCall(code: string, onLeaveRequested: () => void) {
  const handleLeaveRequest = useEffectEvent(onLeaveRequested);

  useEffect(() => {
    const tabs = openCallTabs();
    if (tabs === undefined) return;
    const stop = tabs.announceCall(code, () => handleLeaveRequest());
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
      tabs.close();
    };
  }, [code]);
}

/**
 * The call open in another tab of this browser (its room code), if any, and how to make
 * those tabs leave before joining here.
 */
export function useOtherTabCall(): { code: string | undefined; leaveOtherTabs: () => void } {
  const [calls, setCalls] = useState<OtherTabCalls>(NO_OTHER_TAB_CALLS);
  const tabsRef = useRef<CallTabs>(undefined);

  useEffect(() => {
    const tabs = openCallTabs();
    if (tabs === undefined) return;
    tabsRef.current = tabs;
    const stop = tabs.watchOtherCalls(setCalls);
    return () => {
      stop();
      tabs.close();
      tabsRef.current = undefined;
    };
  }, []);

  return {
    code: firstOtherTabCall(calls),
    leaveOtherTabs: () => tabsRef.current?.askToLeave(calls),
  };
}
