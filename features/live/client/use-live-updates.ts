import { useEffect, useEffectEvent } from "react";
import { useRevalidator } from "react-router";
import { startLiveConnection } from "@/features/live/client/live-connection";

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
    return startLiveConnection(refresh);
  }, [signedIn]);
}
