import { useEffect } from "react";
import { toast } from "sonner";
import { OFFLINE_MESSAGE } from "@/lib/operations/operation";

const NOTICE_ID = "offline";

/**
 * While the browser is offline a notice stays on screen, so a failed save or a link that
 * does not open has a reason the person can see. It goes away when the connection is back.
 */
export function useOfflineNotice() {
  useEffect(() => {
    const show = () => toast.error(OFFLINE_MESSAGE, { id: NOTICE_ID, duration: Infinity });
    const hide = () => toast.dismiss(NOTICE_ID);
    if (!navigator.onLine) show();
    window.addEventListener("offline", show);
    window.addEventListener("online", hide);
    return () => {
      window.removeEventListener("offline", show);
      window.removeEventListener("online", hide);
    };
  }, []);
}
