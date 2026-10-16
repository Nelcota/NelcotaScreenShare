import { useEffect, useEffectEvent } from "react";
import { useRevalidator } from "react-router";
import { sessionEndedHref } from "@/features/auth/domain/session-ended";
import { startLiveConnection } from "@/features/live/client/live-connection";

/**
 * A session ended elsewhere: sign in again, with a notice and the way back. A full page load,
 * so a call in progress ends cleanly (LiveKit leaves on page exit) and nothing stale remains.
 */
function leaveForSignIn() {
  window.location.assign(sessionEndedHref(window.location.pathname + window.location.search));
}

/**
 * While signed in, reloads the page data when the server nudges this account: friends,
 * requests and status show up without F5.
 */
export function useLiveUpdates(signedIn: boolean) {
  const revalidator = useRevalidator();
  const refresh = useEffectEvent(() => {
    void revalidator.revalidate();
  });
  useEffect(() => {
    if (!signedIn) return;
    return startLiveConnection(refresh, leaveForSignIn);
  }, [signedIn]);
}
