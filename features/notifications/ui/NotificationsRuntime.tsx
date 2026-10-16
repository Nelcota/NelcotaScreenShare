import { useEffect } from "react";
import { setFaviconBadge } from "@/features/notifications/client/favicon-badge";
import { useNotificationPreferences } from "@/features/notifications/client/preferences-store";
import { unlockRingAudio } from "@/features/notifications/client/ring";
import { prepareSystemNotifications } from "@/features/notifications/client/system-notification";
import { clearUnread, useUnreadCount } from "@/features/notifications/client/unread-store";
import { titleWithUnread } from "@/features/notifications/domain/unread";
import { NotificationOffer } from "@/features/notifications/ui/NotificationOffer";

/** Back on the tab: whatever arrived meanwhile has been seen. */
function useClearUnreadOnReturn() {
  useEffect(() => {
    const seen = () => {
      if (document.visibilityState === "visible") clearUnread();
    };
    document.addEventListener("visibilitychange", seen);
    window.addEventListener("focus", seen);
    return () => {
      document.removeEventListener("visibilitychange", seen);
      window.removeEventListener("focus", seen);
    };
  }, []);
}

/** "(3) Nelcota", kept when a navigation replaces the title. */
function useUnreadTitle(count: number) {
  useEffect(() => {
    const apply = () => {
      const next = titleWithUnread(document.title, count);
      if (document.title !== next) document.title = next;
    };
    apply();
    void setFaviconBadge(count);
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [count]);
}

/** A call can only ring after the first click or key press on the site. */
function useRingUnlock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => void unlockRingAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);
}

/**
 * Mounted once in the app: the tab title and icon, ring audio, the notifications worker and
 * the offer to turn notifications on.
 */
export function NotificationsRuntime() {
  const preferences = useNotificationPreferences();
  const unread = useUnreadCount();
  useClearUnreadOnReturn();
  useUnreadTitle(unread);
  useRingUnlock(preferences.ringSound);
  useEffect(() => {
    if (preferences.browserNotifications) prepareSystemNotifications();
  }, [preferences.browserNotifications]);
  return <NotificationOffer />;
}
