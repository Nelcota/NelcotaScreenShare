import { useEffect, useRef, useState } from "react";
import { checkJoinRequest } from "@/features/room/client/api";
import { JOIN_REQUEST_WAIT_MS } from "@/features/room/domain/room-access";

/** How the wait ended. */
export type ApprovalAnswer = "accepted" | "declined" | "expired" | "cancelled";

const CHECK_EVERY_MS = 2000;
/** A little past the server's limit, so the server decides when the wait lapses. */
const MAX_CHECKS = Math.ceil((JOIN_REQUEST_WAIT_MS + 10_000) / CHECK_EVERY_MS);

/**
 * Waits between checks, or less when the tab comes back into view or gets focus: browsers
 * slow down timers in background tabs, and the answer may already be there.
 */
function pause(ms: number) {
  return new Promise<void>((resolve) => {
    function done() {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", done);
      resolve();
    }
    function onVisible() {
      if (document.visibilityState === "visible") done();
    }
    const timer = window.setTimeout(done, ms);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", done);
  });
}

/** Waits for the owner or a moderator to answer a request to enter. */
export function useJoinApproval() {
  const [waiting, setWaiting] = useState(false);
  const cancelled = useRef(false);
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  async function check(requestId: string, checksLeft: number): Promise<ApprovalAnswer> {
    await pause(CHECK_EVERY_MS);
    if (cancelled.current) return "cancelled";
    if (checksLeft <= 0) return "expired";
    const status = await checkJoinRequest(requestId);
    if (status === "accepted" || status === "declined" || status === "expired") return status;
    return check(requestId, checksLeft - 1);
  }

  async function waitForApproval(requestId: string): Promise<ApprovalAnswer> {
    cancelled.current = false;
    setWaiting(true);
    try {
      return await check(requestId, MAX_CHECKS);
    } finally {
      setWaiting(false);
    }
  }

  return {
    waiting,
    waitForApproval,
    cancel: () => {
      cancelled.current = true;
    },
  };
}
