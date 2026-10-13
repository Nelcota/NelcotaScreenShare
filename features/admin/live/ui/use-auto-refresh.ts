import { useEffect } from "react";
import { useRevalidator } from "react-router";

/** Reloads the page data every `intervalMs` while the tab is visible. */
export function useAutoRefresh(intervalMs: number) {
  const revalidator = useRevalidator();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (revalidator.state !== "idle") return;
      void revalidator.revalidate();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, revalidator]);
}
