import { useEffect } from "react";
import { logBrowserWarning } from "@/lib/telemetry.client";

const PRESENCE_URL = "/api/amigos/presenca";
const BEAT_MS = 45_000;

async function beat() {
  try {
    await fetch(PRESENCE_URL, { method: "POST", credentials: "same-origin" });
  } catch (error) {
    // Offline or a page closing: the next beat tries again.
    logBrowserWarning("Presence beat failed", error);
  }
}

/** While the site is open, tells the server this person is online. */
export function usePresenceBeat(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    void beat();
    const timer = setInterval(() => void beat(), BEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn]);
}
